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
