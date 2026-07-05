-- ============================================================
-- Fase 1 — Triggers y RPCs del MVP
-- ============================================================

-- ---------- Perfil automático al registrarse ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_name text;
begin
  -- Username a partir del nombre OAuth o del prefijo del email
  v_base := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
  v_base := regexp_replace(lower(v_base), '[^a-z0-9_]', '', 'g');
  if length(v_base) < 3 then v_base := 'jugador'; end if;
  v_name := v_base;
  -- Evitar colisiones añadiendo sufijo
  while exists (select 1 from profiles where username = v_name) loop
    v_name := v_base || floor(random() * 10000)::text;
  end loop;
  insert into profiles (id, username) values (new.id, v_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- El host entra como miembro al crear la sala ----------
create or replace function handle_new_room() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into room_members (room_id, user_id, role) values (new.id, new.host_id, 'host');
  return new;
end;
$$;

create trigger on_room_created
  after insert on rooms
  for each row execute function handle_new_room();

-- ---------- RPC: unirse a una sala por código de invitación ----------
create or replace function join_room(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms;
begin
  select * into v_room from rooms where invite_code = lower(trim(p_code));
  if not found then raise exception 'Código de invitación no válido'; end if;
  if v_room.status = 'closed' then raise exception 'La sala está cerrada'; end if;
  if exists (select 1 from room_members
             where room_id = v_room.id and user_id = auth.uid() and banned) then
    raise exception 'Has sido expulsado de esta sala';
  end if;
  insert into room_members (room_id, user_id)
  values (v_room.id, auth.uid())
  on conflict (room_id, user_id) do nothing;
  return v_room.id;
end;
$$;

-- ---------- RPC: tirada numérica en servidor con semilla verificable ----------
-- p_definition: {"parts": [{"sides": 6, "count": 2}, ...], "modifier": 0}
-- Cada valor se deriva de md5(seed:parte:dado) → reproducible desde la semilla.
create or replace function roll_dice(p_room uuid, p_definition jsonb, p_label text default null)
returns roll_history
language plpgsql security definer set search_path = public as $$
declare
  v_seed text;
  v_part jsonb;
  v_results jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_sides int;
  v_count int;
  v_val int;
  v_raw int;
  v_pi int := 0;
  v_row roll_history;
  v_member room_members;
begin
  -- Validar membresía y estado
  select * into v_member from room_members
    where room_id = p_room and user_id = auth.uid() and not banned;
  if not found then raise exception 'No eres miembro de esta sala'; end if;
  if v_member.muted then raise exception 'Estás silenciado en esta sala'; end if;
  if exists (select 1 from rooms where id = p_room and status = 'closed') then
    raise exception 'La sala está cerrada';
  end if;
  if jsonb_array_length(coalesce(p_definition -> 'parts', '[]'::jsonb)) = 0 then
    raise exception 'Tirada vacía';
  end if;

  v_seed := encode(gen_random_bytes(16), 'hex');

  for v_part in select * from jsonb_array_elements(p_definition -> 'parts') loop
    v_pi := v_pi + 1;
    v_sides := (v_part ->> 'sides')::int;
    v_count := coalesce((v_part ->> 'count')::int, 1);
    if v_sides < 2 or v_sides > 1000 or v_count < 1 or v_count > 100 then
      raise exception 'Definición de dado no válida';
    end if;
    for i in 1..v_count loop
      -- 32 bits del hash, sin signo, módulo caras
      v_raw := ('x' || substr(md5(v_seed || ':' || v_pi || ':' || i), 1, 8))::bit(32)::int;
      v_val := ((v_raw::bigint & 2147483647) % v_sides)::int + 1;
      v_total := v_total + v_val;
      v_results := v_results || jsonb_build_object('die', 'd' || v_sides, 'value', v_val);
    end loop;
  end loop;

  v_total := v_total + coalesce((p_definition ->> 'modifier')::int, 0);

  insert into roll_history (room_id, user_id, definition, results, total, seed)
  values (p_room, auth.uid(),
          p_definition || jsonb_build_object('label', p_label),
          v_results, v_total, v_seed)
  returning * into v_row;
  return v_row;
end;
$$;
