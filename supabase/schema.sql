-- ============================================================
--  PLANIFICADOR FAMILIAR - Esquema de base de datos (Supabase)
--  Ejecutar en: Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Extensiones necesarias
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  perfiles (uno por miembro de la familia)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,                     -- formato internacional: +34600000000
  color text not null default '#e74c3c',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
--  categorías
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '📌',
  color text not null default '#e67e22'
);

-- ------------------------------------------------------------
--  tareas
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  priority text not null default 'normal' check (priority in ('baja','normal','alta')),
  due_date date,
  due_time time,
  recurrence text not null default 'none'
    check (recurrence in ('none','daily','weekdays','weekly','monthly')),
  status text not null default 'pending'
    check (status in ('pending','accepted','done','declined')),
  decline_reason text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_status_idx on public.tasks (status);

-- ------------------------------------------------------------
--  suscripciones push (una por dispositivo)
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
--  registro de recordatorios enviados (evita repetir avisos)
-- ------------------------------------------------------------
create table if not exists public.reminder_log (
  task_id uuid not null references public.tasks(id) on delete cascade,
  kind text not null check (kind in ('due_soon','due_soon_1h','pending_24h')),
  sent_at timestamptz not null default now(),
  primary key (task_id, kind)
);

-- Actualización de una base de datos ya creada (amplía los kinds de aviso):
--   alter table public.reminder_log drop constraint reminder_log_kind_check;
--   alter table public.reminder_log add constraint reminder_log_kind_check
--     check (kind in ('due_soon','due_soon_1h','pending_24h'));

-- ------------------------------------------------------------
--  RLS: todos los miembros son iguales (familia de confianza)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security;

create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update" on public.profiles
  for update to authenticated using (true);

create policy "categories_all" on public.categories
  for all to authenticated using (true) with check (true);

create policy "tasks_all" on public.tasks
  for all to authenticated using (true) with check (true);

create policy "push_insert" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push_select" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push_delete" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

-- La función de recordatorios accede con service_role (sin RLS).
create policy "reminder_log_all" on public.reminder_log
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
--  categorías iniciales
-- ------------------------------------------------------------
insert into public.categories (name, icon, color) values
  ('Casa',     '🏠', '#27ae60'),
  ('Compras',  '🛒', '#e67e22'),
  ('Escuela',  '📚', '#2980b9'),
  ('Salud',    '💊', '#c0392b'),
  ('Mascotas', '🐾', '#8e44ad'),
  ('Otro',     '📌', '#7f8c8d')
on conflict (name) do nothing;
