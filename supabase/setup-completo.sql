-- ============================================================
-- Fase 0 — Esquema base de datos (Supabase / Postgres)
-- WebApp de gestión de tiradas de dados
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type app_role as enum ('user', 'admin');
create type room_status as enum ('open', 'closed');
create type member_role as enum ('host', 'player');
create type library_status as enum ('pending', 'approved', 'featured', 'rejected');

-- ---------- Perfiles (extiende auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role app_role not null default 'user',
  created_at timestamptz not null default now()
);

-- ---------- Dados personalizados ----------
-- faces: array JSONB, cada cara es {"value": <número>} o {"symbol": "<catálogo>"}
-- Catálogo de símbolos: exito, fallo, critico, blanco, escudo, espada
create table dice (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  faces jsonb not null,
  cloned_from uuid,                    -- library_items.id si fue importado
  created_at timestamptz not null default now(),
  constraint faces_no_vacias check (jsonb_array_length(faces) between 2 and 100)
);

-- ---------- Tiradas guardadas ----------
-- definition: {"parts": [{"die_id": "<uuid>", "count": 2}, ...], "modifier": 0}
create table saved_rolls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  definition jsonb not null,
  cloned_from uuid,
  created_at timestamptz not null default now()
);

-- ---------- Salas privadas ----------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  game text,
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  status room_status not null default 'open',
  created_at timestamptz not null default now()
);

create table room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'player',
  muted boolean not null default false,
  banned boolean not null default false,  -- expulsado: no puede reentrar
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Dados habilitados en cada sala
create table room_dice (
  room_id uuid not null references rooms(id) on delete cascade,
  die_id uuid not null references dice(id) on delete cascade,
  primary key (room_id, die_id)
);

-- ---------- Historial de tiradas ----------
create table roll_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references profiles(id),
  definition jsonb not null,   -- qué se tiró
  results jsonb not null,      -- desglose por dado: [{"die":"d6","face":{"value":4}}, ...]
  total numeric,               -- suma (dados numéricos + modificador)
  symbols jsonb,               -- conteo agregado: {"exito": 3, "fallo": 1}
  seed text not null,          -- semilla registrada → aleatoriedad verificable
  created_at timestamptz not null default now()
);

create index roll_history_room_idx on roll_history (room_id, created_at desc);

-- ---------- Biblioteca comunitaria ----------
-- content: {"dice": [...], "rolls": [...]} — paquete completo clonable
create table library_items (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  game text,
  tags text[] not null default '{}',
  content jsonb not null,
  status library_status not null default 'pending',
  clones integer not null default 0,
  created_at timestamptz not null default now()
);

create index library_items_search_idx on library_items (status, game);
create index library_items_tags_idx on library_items using gin (tags);

-- ============================================================
-- RLS — Seguridad por rol y sala
-- ============================================================
alter table profiles     enable row level security;
alter table dice         enable row level security;
alter table saved_rolls  enable row level security;
alter table rooms        enable row level security;
alter table room_members enable row level security;
alter table room_dice    enable row level security;
alter table roll_history enable row level security;
alter table library_items enable row level security;

-- Helper: ¿es admin el usuario actual?
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Helper: ¿es miembro activo (no baneado) de la sala?
create or replace function is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members
    where room_id = p_room and user_id = auth.uid() and not banned
  );
$$;

-- Perfiles: lectura pública (usernames), edición propia, admin todo
create policy profiles_select on profiles for select using (true);
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_admin());

-- Dados y tiradas guardadas: CRUD solo del dueño (admin puede leer)
create policy dice_own on dice for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy dice_admin_read on dice for select using (is_admin());
create policy saved_rolls_own on saved_rolls for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Salas: ven miembros; crea cualquier usuario autenticado; gestiona el host
create policy rooms_select on rooms for select
  using (is_room_member(id) or host_id = auth.uid() or is_admin());
create policy rooms_insert on rooms for insert
  with check (host_id = auth.uid());
create policy rooms_update on rooms for update
  using (host_id = auth.uid() or is_admin());
create policy rooms_delete on rooms for delete
  using (host_id = auth.uid() or is_admin());

-- Miembros: ven los miembros de la sala; el host gestiona (expulsar/silenciar)
create policy room_members_select on room_members for select
  using (is_room_member(room_id) or is_admin());
create policy room_members_host on room_members for update
  using (exists (select 1 from rooms r where r.id = room_id and r.host_id = auth.uid()));
create policy room_members_leave on room_members for delete
  using (user_id = auth.uid()
    or exists (select 1 from rooms r where r.id = room_id and r.host_id = auth.uid()));
-- El alta de miembros se hace vía RPC join_room(invite_code) — sin insert directo.

-- Dados de sala: leen miembros; gestiona el host
create policy room_dice_select on room_dice for select using (is_room_member(room_id));
create policy room_dice_host on room_dice for all
  using (exists (select 1 from rooms r where r.id = room_id and r.host_id = auth.uid()));

-- Historial: leen miembros de la sala. Solo escribe el servidor (RPC security definer).
create policy roll_history_select on roll_history for select
  using (is_room_member(room_id) or is_admin());

-- Biblioteca: aprobados visibles para todos; el autor ve/edita los suyos; admin modera
create policy library_select on library_items for select
  using (status in ('approved', 'featured') or author_id = auth.uid() or is_admin());
create policy library_insert on library_items for insert
  with check (author_id = auth.uid());
create policy library_author_update on library_items for update
  using (author_id = auth.uid() and status = 'pending');
create policy library_admin on library_items for update using (is_admin());
create policy library_delete on library_items for delete
  using (author_id = auth.uid() or is_admin());
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
-- ============================================================
-- Fix: en Supabase, pgcrypto vive en el esquema "extensions".
-- roll_dice usaba search_path = public y no encontraba gen_random_bytes.
-- ============================================================

alter function roll_dice(uuid, jsonb, text) set search_path = public, extensions;
-- ============================================================
-- Fase 2 — Tiempo real
-- Publica los INSERTs de roll_history por el canal Realtime.
-- RLS se respeta: cada cliente solo recibe tiradas de salas
-- donde es miembro (política roll_history_select).
-- ============================================================

alter publication supabase_realtime add table roll_history;
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
-- ============================================================
-- Fase 5 — Seguridad reforzada
-- Evita que un usuario se auto-promocione: solo un admin
-- puede cambiar el campo "role" de un perfil.
-- ============================================================

create or replace function protect_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  return new;
end;
$$;

create trigger on_profile_role_change
  before update on profiles
  for each row execute function protect_role_change();
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
