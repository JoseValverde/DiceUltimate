-- ============================================================
-- Fase 6 — Mejoras
-- 1) Perfil ampliado (bio, redes, email opcional)
-- 2) Invitación directa por username/email (solo host)
-- 3) Tiradas de sala (room_rolls) gestionadas por el host
-- 4) roll_dice v3: dados de sala + etiquetas libres por cara
-- 5) Eliminación total de cuenta
-- ============================================================

-- ---------- 1) Perfil ampliado ----------
alter table profiles
  add column bio text,
  add column socials jsonb not null default '{}'::jsonb,
  add column show_email boolean not null default false;

-- Email visible solo si el usuario lo permite (o es el propio/admin)
create or replace function public_email(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select u.email::text
  from auth.users u
  join profiles p on p.id = u.id
  where u.id = p_user
    and (p.show_email or p_user = auth.uid() or is_admin());
$$;

-- ---------- 2) Invitación directa (por username o email exacto) ----------
create or replace function invite_member(p_room uuid, p_query text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
  v_name text;
  v_q text := lower(trim(p_query));
begin
  if not exists (select 1 from rooms where id = p_room and host_id = auth.uid()) then
    raise exception 'Solo el anfitrión puede invitar';
  end if;

  select p.id, p.username into v_target, v_name
  from profiles p
  left join auth.users u on u.id = p.id
  where lower(p.username) = v_q or lower(u.email) = v_q
  limit 1;

  if v_target is null then
    raise exception 'No hay ningún usuario registrado con ese nombre o email';
  end if;

  -- Invitar reactiva a expulsados y silenciados
  insert into room_members (room_id, user_id)
  values (p_room, v_target)
  on conflict (room_id, user_id)
  do update set banned = false, muted = false;

  return v_name;
end;
$$;

-- ---------- 3) Tiradas habilitadas en sala ----------
create table room_rolls (
  room_id uuid not null references rooms(id) on delete cascade,
  roll_id uuid not null references saved_rolls(id) on delete cascade,
  primary key (room_id, roll_id)
);
alter table room_rolls enable row level security;

create policy room_rolls_select on room_rolls for select
  using (is_room_member(room_id));
create policy room_rolls_host on room_rolls for all
  using (exists (select 1 from rooms r where r.id = room_id and r.host_id = auth.uid()));

-- Los miembros pueden LEER las tiradas habilitadas en sus salas
create policy saved_rolls_room_read on saved_rolls for select using (
  exists (
    select 1
    from room_rolls rr
    join room_members rm on rm.room_id = rr.room_id
    where rr.roll_id = saved_rolls.id
      and rm.user_id = auth.uid()
      and not rm.banned
  )
);

-- ---------- 4) roll_dice v3 ----------
-- Dados personalizados usables SOLO si están habilitados en la sala,
-- o si quien tira es el anfitrión y dueño del dado.
-- Caras con etiqueta libre: {"symbol":"fuego","label":"Bola de fuego"}.
-- El conteo agrega por etiqueta (o símbolo si no hay etiqueta).
create or replace function roll_dice(p_room uuid, p_definition jsonb, p_label text default null)
returns roll_history
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_seed text;
  v_part jsonb;
  v_results jsonb := '[]'::jsonb;
  v_symbols jsonb := '{}'::jsonb;
  v_total bigint := 0;
  v_has_num boolean := false;
  v_sides int;
  v_count int;
  v_val int;
  v_raw int;
  v_idx int;
  v_pi int := 0;
  v_mod int;
  v_sym text;
  v_key text;
  v_face jsonb;
  v_die dice;
  v_row roll_history;
  v_member room_members;
  v_es_host boolean;
begin
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

  v_es_host := exists (select 1 from rooms where id = p_room and host_id = auth.uid());
  v_seed := encode(gen_random_bytes(16), 'hex');

  for v_part in select * from jsonb_array_elements(p_definition -> 'parts') loop
    v_pi := v_pi + 1;
    v_count := coalesce((v_part ->> 'count')::int, 1);
    if v_count < 1 or v_count > 100 then raise exception 'Cantidad no válida'; end if;

    if v_part ? 'die_id' then
      select * into v_die from dice where id = (v_part ->> 'die_id')::uuid;
      if not found then raise exception 'Dado no encontrado'; end if;
      if not exists (select 1 from room_dice where room_id = p_room and die_id = v_die.id)
         and not (v_es_host and v_die.owner_id = auth.uid()) then
        raise exception 'Ese dado no está habilitado en esta sala';
      end if;
      v_sides := jsonb_array_length(v_die.faces);
      for i in 1..v_count loop
        v_raw := ('x' || substr(md5(v_seed || ':' || v_pi || ':' || i), 1, 8))::bit(32)::int;
        v_idx := ((v_raw::bigint & 2147483647) % v_sides)::int;
        v_face := v_die.faces -> v_idx;
        if v_face ? 'value' then
          v_total := v_total + (v_face ->> 'value')::int;
          v_has_num := true;
          v_results := v_results
            || jsonb_build_object('die', v_die.name, 'value', (v_face ->> 'value')::int);
        else
          v_sym := v_face ->> 'symbol';
          v_key := coalesce(nullif(v_face ->> 'label', ''), v_sym);
          v_symbols := jsonb_set(
            v_symbols, array[v_key],
            to_jsonb(coalesce((v_symbols ->> v_key)::int, 0) + 1)
          );
          v_results := v_results || (
            jsonb_build_object('die', v_die.name, 'symbol', v_sym)
            || case when v_face ? 'label'
                 then jsonb_build_object('label', v_face ->> 'label')
                 else '{}'::jsonb end
          );
        end if;
      end loop;
    else
      v_sides := (v_part ->> 'sides')::int;
      if v_sides < 2 or v_sides > 1000 then raise exception 'Definición de dado no válida'; end if;
      v_has_num := true;
      for i in 1..v_count loop
        v_raw := ('x' || substr(md5(v_seed || ':' || v_pi || ':' || i), 1, 8))::bit(32)::int;
        v_val := ((v_raw::bigint & 2147483647) % v_sides)::int + 1;
        v_total := v_total + v_val;
        v_results := v_results || jsonb_build_object('die', 'd' || v_sides, 'value', v_val);
      end loop;
    end if;
  end loop;

  v_mod := coalesce((p_definition ->> 'modifier')::int, 0);
  v_total := v_total + v_mod;

  insert into roll_history (room_id, user_id, definition, results, total, symbols, seed)
  values (
    p_room, auth.uid(),
    p_definition || jsonb_build_object('label', p_label),
    v_results,
    case when v_has_num or v_mod <> 0 then v_total else null end,
    nullif(v_symbols, '{}'::jsonb),
    v_seed
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------- 5) Eliminación total de cuenta ----------
-- Borra las tiradas del usuario en salas ajenas y después su usuario de auth,
-- que arrastra en cascada: perfil → salas propias (con su historial),
-- dados, tiradas guardadas, membresías y publicaciones. Cero rastro.
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from roll_history where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;
