-- ============================================================
-- 0001_init.sql
-- Mini SaaS tipo "Factorial": organizaciones (tenants), jerarquía de
-- roles/permisos, fichaje + horas por proyecto, vacaciones, tareas.
-- Auditoría genérica reutilizable para todas las tablas.
-- ============================================================

-- ------------------------------------------------------------
-- profiles (datos de usuario, 1:1 con auth.users, sin lógica de org)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil automáticamente cuando se registra un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- organizations (tenants)
-- ------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- roles & permissions (catálogo global, reutilizable sin tocar código)
-- ------------------------------------------------------------
create table public.roles (
  id text primary key,          -- 'owner' | 'admin' | 'manager' | 'employee'
  name text not null,
  level smallint not null       -- mayor = más jerarquía
);

insert into public.roles (id, name, level) values
  ('owner', 'Owner', 4),
  ('admin', 'Administrador', 3),
  ('manager', 'Manager', 2),
  ('employee', 'Empleado', 1);

create table public.permissions (
  key text primary key,         -- ej. 'employees.manage', 'vacations.approve'
  description text not null
);

insert into public.permissions (key, description) values
  ('employees.manage', 'Alta/baja y edición de empleados'),
  ('projects.manage', 'Crear/editar proyectos'),
  ('tasks.manage_all', 'Editar tareas de cualquier empleado'),
  ('time.view_team', 'Ver fichajes y horas del equipo a cargo'),
  ('vacations.approve', 'Aprobar/rechazar solicitudes de vacaciones del equipo');

create table public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'employees.manage'), ('owner', 'projects.manage'), ('owner', 'tasks.manage_all'),
  ('owner', 'time.view_team'), ('owner', 'vacations.approve'),
  ('admin', 'employees.manage'), ('admin', 'projects.manage'), ('admin', 'tasks.manage_all'),
  ('admin', 'time.view_team'), ('admin', 'vacations.approve'),
  ('manager', 'time.view_team'), ('manager', 'vacations.approve');

-- ------------------------------------------------------------
-- memberships (usuario <-> organización, con rol y jerarquía)
-- ------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id text not null references public.roles (id),
  manager_id uuid references public.memberships (id) on delete set null,
  position text,
  weekly_hours numeric not null default 40,       -- capacidad semanal, para medir carga de trabajo
  annual_vacation_days numeric not null default 22,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Helper: la membresía del usuario autenticado en una org dada
create or replace function public.current_membership(p_org_id uuid)
returns public.memberships
language sql
stable
security definer
set search_path = public
as $$
  select m.* from public.memberships m
  where m.org_id = p_org_id and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

-- Helper: ¿el usuario autenticado tiene este permiso en esta org?
create or replace function public.has_permission(p_org_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission_key = p_key
  );
$$;

-- Helper: ¿target_membership reporta (directa o indirectamente) a manager_membership?
create or replace function public.is_in_reporting_line(p_manager_membership_id uuid, p_target_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select id, manager_id from public.memberships where id = p_target_membership_id
    union all
    select m.id, m.manager_id
    from public.memberships m
    join chain c on m.id = c.manager_id
  )
  select exists (select 1 from chain where manager_id = p_manager_membership_id);
$$;

alter table public.memberships enable row level security;

create policy "memberships: select within own org"
  on public.memberships for select
  using (exists (
    select 1 from public.memberships me
    where me.org_id = memberships.org_id and me.user_id = auth.uid() and me.status = 'active'
  ));

create policy "memberships: manage with employees.manage permission"
  on public.memberships for all
  using (public.has_permission(org_id, 'employees.manage'))
  with check (public.has_permission(org_id, 'employees.manage'));

-- ------------------------------------------------------------
-- projects & tasks
-- ------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  client_name text,
  budgeted_hours numeric,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects: select within own org"
  on public.projects for select
  using (exists (
    select 1 from public.memberships me
    where me.org_id = projects.org_id and me.user_id = auth.uid() and me.status = 'active'
  ));

create policy "projects: manage with projects.manage permission"
  on public.projects for all
  using (public.has_permission(org_id, 'projects.manage'))
  with check (public.has_permission(org_id, 'projects.manage'));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.memberships (id) on delete set null,
  estimated_hours numeric,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks: select within own org"
  on public.tasks for select
  using (exists (
    select 1 from public.projects p
    join public.memberships me on me.org_id = p.org_id
    where p.id = tasks.project_id and me.user_id = auth.uid() and me.status = 'active'
  ));

create policy "tasks: update own assigned task or manage_all permission"
  on public.tasks for update
  using (
    assigned_to = (select id from public.memberships where user_id = auth.uid() and org_id = (
      select org_id from public.projects where id = tasks.project_id
    ))
    or public.has_permission((select org_id from public.projects where id = tasks.project_id), 'tasks.manage_all')
  );

create policy "tasks: insert/delete with manage_all permission"
  on public.tasks for insert
  with check (public.has_permission((select org_id from public.projects where id = tasks.project_id), 'tasks.manage_all'));

create policy "tasks: delete with manage_all permission"
  on public.tasks for delete
  using (public.has_permission((select org_id from public.projects where id = tasks.project_id), 'tasks.manage_all'));

-- ------------------------------------------------------------
-- time_entries: reutilizada tanto para fichaje (entry_type='clock',
-- task_id null) como para horas dedicadas a una tarea/proyecto
-- (entry_type='task', task_id not null)
-- ------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  entry_type text not null check (entry_type in ('clock', 'task')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (entry_type = 'clock' or task_id is not null)
);

alter table public.time_entries enable row level security;

create policy "time_entries: select own or team (time.view_team)"
  on public.time_entries for select
  using (
    membership_id = (select id from public.memberships where user_id = auth.uid())
    or public.is_in_reporting_line(
      (select id from public.memberships where user_id = auth.uid() and org_id = (
        select org_id from public.memberships where id = time_entries.membership_id
      )),
      membership_id
    )
  );

create policy "time_entries: insert/update own"
  on public.time_entries for insert
  with check (membership_id = (select id from public.memberships where user_id = auth.uid()));

create policy "time_entries: update own open entry"
  on public.time_entries for update
  using (membership_id = (select id from public.memberships where user_id = auth.uid()));

-- ------------------------------------------------------------
-- vacation_requests (workflow de aprobación por jerarquía)
-- ------------------------------------------------------------
create table public.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text,
  decided_by uuid references public.memberships (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.vacation_requests enable row level security;

create policy "vacation_requests: select own or team (vacations.approve)"
  on public.vacation_requests for select
  using (
    membership_id = (select id from public.memberships where user_id = auth.uid())
    or public.has_permission(
      (select org_id from public.memberships where id = vacation_requests.membership_id),
      'vacations.approve'
    )
  );

create policy "vacation_requests: insert own"
  on public.vacation_requests for insert
  with check (membership_id = (select id from public.memberships where user_id = auth.uid()));

create policy "vacation_requests: approve/reject with permission"
  on public.vacation_requests for update
  using (public.has_permission(
    (select org_id from public.memberships where id = vacation_requests.membership_id),
    'vacations.approve'
  ));

-- Vista: saldo de vacaciones por membership/año (calculado, no duplicado en una columna)
create view public.vacation_balances as
select
  m.id as membership_id,
  m.annual_vacation_days,
  extract(year from current_date)::int as year,
  coalesce(sum(vr.end_date - vr.start_date + 1) filter (
    where vr.status = 'approved'
      and extract(year from vr.start_date) = extract(year from current_date)
  ), 0) as used_days
from public.memberships m
left join public.vacation_requests vr on vr.membership_id = m.id
group by m.id, m.annual_vacation_days;

-- ------------------------------------------------------------
-- audit_log (genérica, reutilizable para cualquier tabla nueva)
-- ------------------------------------------------------------
create schema if not exists audit;

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "audit_log: select own"
  on public.audit_log for select
  using (auth.uid() = user_id);
-- Sin policies de insert/update/delete: solo las funciones security definer
-- de abajo pueden escribir, así el log queda inmutable desde el cliente.

-- Trigger genérico: se puede enganchar a cualquier tabla nueva sin código extra
create or replace function audit.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id::text, old.id::text),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- Eventos manuales no ligados a una fila (login, logout, export, etc.)
create or replace function public.log_event(p_action text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (user_id, action, metadata)
  values (auth.uid(), p_action, p_metadata);
end;
$$;

-- Auditoría enganchada a las tablas donde los cambios importan de verdad
create trigger trg_audit_memberships
  after insert or update or delete on public.memberships
  for each row execute function audit.log_change();

create trigger trg_audit_vacation_requests
  after insert or update or delete on public.vacation_requests
  for each row execute function audit.log_change();

create trigger trg_audit_time_entries
  after insert or update or delete on public.time_entries
  for each row execute function audit.log_change();

create trigger trg_audit_tasks
  after insert or update or delete on public.tasks
  for each row execute function audit.log_change();

-- Para auditar una tabla nueva en el futuro, basta con:
-- create trigger trg_audit_<tabla>
--   after insert or update or delete on public.<tabla>
--   for each row execute function audit.log_change();
