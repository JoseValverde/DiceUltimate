-- ============================================================
-- Fase 3 — Dados personalizados y símbolos
-- 1) Los miembros pueden LEER dados habilitados en sus salas.
-- 2) roll_dice v2: acepta dados estándar {sides,count} y
--    personalizados {die_id,count}; agrega conteo de símbolos.
-- ============================================================

-- Miembros de una sala pueden ver los dados habilitados en ella
create policy dice_room_read on dice for select using (
  exists (
    select 1
    from room_dice rd
    join room_members rm on rm.room_id = rd.room_id
    where rd.die_id = dice.id
      and rm.user_id = auth.uid()
      and not rm.banned
  )
);

-- roll_dice v2
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
  v_face jsonb;
  v_die dice;
  v_row roll_history;
  v_member room_members;
begin
  -- Validar membresía y estado de la sala
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
    v_count := coalesce((v_part ->> 'count')::int, 1);
    if v_count < 1 or v_count > 100 then raise exception 'Cantidad no válida'; end if;

    if v_part ? 'die_id' then
      -- ---- Dado personalizado ----
      select * into v_die from dice where id = (v_part ->> 'die_id')::uuid;
      if not found then raise exception 'Dado no encontrado'; end if;
      -- Permitido: dueño del dado o dado habilitado en esta sala
      if v_die.owner_id <> auth.uid()
         and not exists (select 1 from room_dice
                         where room_id = p_room and die_id = v_die.id) then
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
          v_symbols := jsonb_set(
            v_symbols, array[v_sym],
            to_jsonb(coalesce((v_symbols ->> v_sym)::int, 0) + 1)
          );
          v_results := v_results
            || jsonb_build_object('die', v_die.name, 'symbol', v_sym);
        end if;
      end loop;
    else
      -- ---- Dado numérico estándar (dN) ----
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
