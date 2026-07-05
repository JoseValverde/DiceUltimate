-- ============================================================
-- Fase 4 — Biblioteca comunitaria
-- Clonado de configuraciones: copia dados y tiradas del paquete
-- a la cuenta del usuario, remapeando las referencias de dados
-- (die_ref = índice en el paquete → die_id nuevo).
-- ============================================================

create or replace function clone_library_item(p_item uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_item library_items;
  v_d jsonb;
  v_r jsonb;
  v_part jsonb;
  v_new_parts jsonb;
  v_new_ids uuid[] := '{}';
  v_id uuid;
  v_ref int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select * into v_item from library_items where id = p_item;
  if not found then raise exception 'Elemento no encontrado'; end if;
  if v_item.status not in ('approved', 'featured') and v_item.author_id <> auth.uid() then
    raise exception 'Elemento no disponible';
  end if;

  -- 1) Clonar dados (el orden define el índice die_ref)
  for v_d in select * from jsonb_array_elements(coalesce(v_item.content -> 'dice', '[]'::jsonb)) loop
    insert into dice (owner_id, name, faces, cloned_from)
    values (auth.uid(), v_d ->> 'name', v_d -> 'faces', p_item)
    returning id into v_id;
    v_new_ids := v_new_ids || v_id;
  end loop;

  -- 2) Clonar tiradas, sustituyendo die_ref por el die_id recién creado
  for v_r in select * from jsonb_array_elements(coalesce(v_item.content -> 'rolls', '[]'::jsonb)) loop
    v_new_parts := '[]'::jsonb;
    for v_part in select * from jsonb_array_elements(coalesce(v_r -> 'definition' -> 'parts', '[]'::jsonb)) loop
      if v_part ? 'die_ref' then
        v_ref := (v_part ->> 'die_ref')::int + 1;
        if v_ref < 1 or v_ref > coalesce(array_length(v_new_ids, 1), 0) then
          raise exception 'Referencia de dado no válida en el paquete';
        end if;
        v_new_parts := v_new_parts
          || ((v_part - 'die_ref') || jsonb_build_object('die_id', v_new_ids[v_ref]));
      else
        v_new_parts := v_new_parts || v_part;
      end if;
    end loop;
    insert into saved_rolls (owner_id, name, definition, cloned_from)
    values (
      auth.uid(),
      v_r ->> 'name',
      jsonb_set(coalesce(v_r -> 'definition', '{}'::jsonb), '{parts}', v_new_parts),
      p_item
    );
  end loop;

  -- 3) Contador de clonados
  update library_items set clones = clones + 1 where id = p_item;
end;
$$;
