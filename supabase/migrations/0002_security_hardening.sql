-- ============================================================
-- 0002_security_hardening.sql
-- Correcciones de la revisión del agente security-audit sobre 0001:
--  * recursión infinita en las policies de memberships
--  * organizations sin RLS
--  * subqueries de una fila que fallan con usuarios en varias orgs
--  * escalada de privilegios (roles, autoaprobación, edición de fichajes)
--  * vista de saldo de vacaciones que saltaba RLS
-- Además agrega el flujo de alta: crear organización e invitaciones.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers security definer (evitan recursión de RLS)
-- ------------------------------------------------------------
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_own_membership(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where id = p_membership_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.membership_org(p_membership_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.memberships where id = p_membership_id;
$$;

create or replace function public.my_membership_id(p_org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.memberships
  where org_id = p_org_id and user_id = auth.uid() and status = 'active';
$$;

-- `union` (no `union all`) para que la CTE termine aunque hubiera un ciclo en los datos
create or replace function public.is_in_reporting_line(p_manager_membership_id uuid, p_target_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select id, manager_id from public.memberships where id = p_target_membership_id
    union
    select m.id, m.manager_id
    from public.memberships m
    join chain c on m.id = c.manager_id
  )
  select exists (select 1 from chain where manager_id = p_manager_membership_id);
$$;

-- ¿El usuario autenticado puede ver/gestionar a esta membership como "su equipo"?
-- Admins (employees.manage) ven a toda la org; managers solo a su línea de reporte.
create or replace function public.can_supervise(p_membership_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_permission(public.membership_org(p_membership_id), p_permission)
    and (
      public.has_permission(public.membership_org(p_membership_id), 'employees.manage')
      or public.is_in_reporting_line(
        public.my_membership_id(public.membership_org(p_membership_id)),
        p_membership_id
      )
    );
$$;

-- ------------------------------------------------------------
-- organizations: RLS + creación atómica (org + owner)
-- ------------------------------------------------------------
alter table public.organizations enable row level security;

create policy "organizations: select if member"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "organizations: update with employees.manage"
  on public.organizations for update
  using (public.has_permission(id, 'employees.manage'));

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'invalid organization name';
  end if;

  insert into public.organizations (name) values (trim(p_name)) returning id into v_org_id;
  insert into public.memberships (org_id, user_id, role_id, position)
  values (v_org_id, auth.uid(), 'owner', 'Owner');
  return v_org_id;
end;
$$;

-- ------------------------------------------------------------
-- memberships: policies sin recursión + anti escalada
-- ------------------------------------------------------------
drop policy "memberships: select within own org" on public.memberships;
drop policy "memberships: manage with employees.manage permission" on public.memberships;

create policy "memberships: select within own org"
  on public.memberships for select
  using (user_id = auth.uid() or public.is_org_member(org_id));

create policy "memberships: update with employees.manage"
  on public.memberships for update
  using (public.has_permission(org_id, 'employees.manage'))
  with check (public.has_permission(org_id, 'employees.manage'));

create policy "memberships: delete with employees.manage"
  on public.memberships for delete
  using (public.has_permission(org_id, 'employees.manage') and user_id <> auth.uid());
-- Sin policy de insert: las memberships se crean solo vía create_organization()
-- o accept_invitation() (security definer).

alter table public.memberships
  add constraint memberships_not_own_manager check (manager_id is null or manager_id <> id);

create or replace function public.guard_membership_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_level smallint;
  v_old_level smallint;
  v_new_level smallint;
begin
  -- Llamadas desde funciones internas/servicio (sin usuario) no se restringen
  if auth.uid() is null then
    return new;
  end if;

  select r.level into v_my_level
  from public.memberships m join public.roles r on r.id = m.role_id
  where m.org_id = new.org_id and m.user_id = auth.uid() and m.status = 'active';

  if new.user_id = auth.uid() and (new.role_id <> old.role_id or new.status <> old.status) then
    raise exception 'cannot change your own role or status';
  end if;

  select level into v_old_level from public.roles where id = old.role_id;
  select level into v_new_level from public.roles where id = new.role_id;

  -- No se puede gestionar a alguien de rango igual o superior, ni asignar un rango >= al propio
  -- (salvo el owner, que puede todo dentro de su org)
  if v_my_level < 4 and (v_old_level >= v_my_level or v_new_level >= v_my_level) then
    raise exception 'insufficient rank for this change';
  end if;

  if new.manager_id is not null
     and public.membership_org(new.manager_id) <> new.org_id then
    raise exception 'manager must belong to the same organization';
  end if;

  if new.manager_id is not null and public.is_in_reporting_line(new.id, new.manager_id) then
    raise exception 'manager assignment would create a cycle';
  end if;

  if new.org_id <> old.org_id or new.user_id <> old.user_id then
    raise exception 'org_id and user_id are immutable';
  end if;

  return new;
end;
$$;

create trigger trg_memberships_guard
  before update on public.memberships
  for each row execute function public.guard_membership_changes();

-- ------------------------------------------------------------
-- profiles: compañeros de org pueden ver nombre/avatar
-- ------------------------------------------------------------
create policy "profiles: select coworkers"
  on public.profiles for select
  using (exists (
    select 1 from public.memberships them
    where them.user_id = profiles.id and public.is_org_member(them.org_id)
  ));

-- Email visible para compañeros (directorio de empleados) sin exponer auth.users
alter table public.profiles add column email text;

update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- projects
-- ------------------------------------------------------------
drop policy "projects: select within own org" on public.projects;
create policy "projects: select within own org"
  on public.projects for select
  using (public.is_org_member(org_id));

-- ------------------------------------------------------------
-- tasks
-- ------------------------------------------------------------
alter table public.tasks add column org_id uuid references public.organizations (id) on delete cascade;
update public.tasks t set org_id = p.org_id from public.projects p where p.id = t.project_id;
alter table public.tasks alter column org_id set not null;

create or replace function public.tasks_sync_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select org_id into new.org_id from public.projects where id = new.project_id;
  if new.assigned_to is not null and public.membership_org(new.assigned_to) <> new.org_id then
    raise exception 'assignee must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger trg_tasks_sync_org
  before insert or update on public.tasks
  for each row execute function public.tasks_sync_org();

drop policy "tasks: select within own org" on public.tasks;
drop policy "tasks: update own assigned task or manage_all permission" on public.tasks;
drop policy "tasks: insert/delete with manage_all permission" on public.tasks;
drop policy "tasks: delete with manage_all permission" on public.tasks;

create policy "tasks: select within own org"
  on public.tasks for select
  using (public.is_org_member(org_id));

create policy "tasks: update assigned or manage_all"
  on public.tasks for update
  using (public.is_own_membership(assigned_to) or public.has_permission(org_id, 'tasks.manage_all'));

create policy "tasks: insert with manage_all"
  on public.tasks for insert
  with check (public.has_permission(
    (select org_id from public.projects where id = project_id), 'tasks.manage_all'
  ));

create policy "tasks: delete with manage_all"
  on public.tasks for delete
  using (public.has_permission(org_id, 'tasks.manage_all'));

-- Un empleado asignado solo puede mover el estado de su tarea, no reasignarla ni reestimarla
create or replace function public.guard_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.has_permission(new.org_id, 'tasks.manage_all') then
    if new.title <> old.title
       or new.description is distinct from old.description
       or new.assigned_to is distinct from old.assigned_to
       or new.estimated_hours is distinct from old.estimated_hours
       or new.project_id <> old.project_id then
      raise exception 'only status can be changed on assigned tasks';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_tasks_guard
  before update on public.tasks
  for each row execute function public.guard_task_changes();

-- ------------------------------------------------------------
-- time_entries
-- ------------------------------------------------------------
drop policy "time_entries: select own or team (time.view_team)" on public.time_entries;
drop policy "time_entries: insert/update own" on public.time_entries;
drop policy "time_entries: update own open entry" on public.time_entries;

create policy "time_entries: select own or supervised"
  on public.time_entries for select
  using (public.is_own_membership(membership_id) or public.can_supervise(membership_id, 'time.view_team'));

create policy "time_entries: insert own"
  on public.time_entries for insert
  with check (public.is_own_membership(membership_id));

create policy "time_entries: update own"
  on public.time_entries for update
  using (public.is_own_membership(membership_id));

create policy "time_entries: delete own task entries"
  on public.time_entries for delete
  using (public.is_own_membership(membership_id) and entry_type = 'task');

-- Un solo fichaje abierto por persona
create unique index time_entries_one_open_clock
  on public.time_entries (membership_id)
  where entry_type = 'clock' and ended_at is null;

alter table public.time_entries
  add constraint time_entries_valid_range check (ended_at is null or ended_at >= started_at);

-- El fichaje (clock) solo se puede cerrar: no se reescribe la hora de entrada.
-- Las horas de tarea sí se pueden corregir (las registra el propio empleado a mano),
-- y quedan igualmente en audit_log.
create or replace function public.guard_time_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.membership_id <> old.membership_id or new.entry_type <> old.entry_type then
    raise exception 'membership and entry type are immutable';
  end if;
  if old.entry_type = 'clock' then
    if new.started_at <> old.started_at then
      raise exception 'clock-in time cannot be modified';
    end if;
    if old.ended_at is not null and new.ended_at is distinct from old.ended_at then
      raise exception 'closed clock entries cannot be modified';
    end if;
  end if;
  if new.task_id is not null and (
    select org_id from public.tasks where id = new.task_id
  ) <> public.membership_org(new.membership_id) then
    raise exception 'task must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger trg_time_entries_guard
  before update on public.time_entries
  for each row execute function public.guard_time_entry_changes();

create or replace function public.guard_time_entry_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.task_id is not null and (
    select org_id from public.tasks where id = new.task_id
  ) <> public.membership_org(new.membership_id) then
    raise exception 'task must belong to the same organization';
  end if;
  -- El fichaje se abre siempre "ahora": no se puede fichar en el pasado
  if new.entry_type = 'clock' and auth.uid() is not null then
    new.started_at := now();
    new.ended_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_time_entries_guard_insert
  before insert on public.time_entries
  for each row execute function public.guard_time_entry_insert();

-- ------------------------------------------------------------
-- vacation_requests: aprobación por jerarquía, nunca la propia
-- ------------------------------------------------------------
drop policy "vacation_requests: select own or team (vacations.approve)" on public.vacation_requests;
drop policy "vacation_requests: insert own" on public.vacation_requests;
drop policy "vacation_requests: approve/reject with permission" on public.vacation_requests;

create policy "vacation_requests: select own or supervised"
  on public.vacation_requests for select
  using (public.is_own_membership(membership_id) or public.can_supervise(membership_id, 'vacations.approve'));

create policy "vacation_requests: insert own"
  on public.vacation_requests for insert
  with check (public.is_own_membership(membership_id) and status = 'pending');

create policy "vacation_requests: update own (cancel) or supervised (decide)"
  on public.vacation_requests for update
  using (public.is_own_membership(membership_id) or public.can_supervise(membership_id, 'vacations.approve'));

create or replace function public.guard_vacation_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean := public.is_own_membership(old.membership_id);
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.membership_id <> old.membership_id
     or new.start_date <> old.start_date
     or new.end_date <> old.end_date then
    raise exception 'request dates and owner are immutable';
  end if;
  if old.status <> 'pending' then
    raise exception 'only pending requests can change';
  end if;

  if v_is_owner then
    -- El solicitante solo puede cancelar
    if new.status not in ('pending', 'cancelled') then
      raise exception 'you cannot decide on your own request';
    end if;
  elsif new.status in ('approved', 'rejected') then
    new.decided_by := public.my_membership_id(public.membership_org(old.membership_id));
    new.decided_at := now();
  else
    raise exception 'invalid status transition';
  end if;
  return new;
end;
$$;

create trigger trg_vacation_requests_guard
  before update on public.vacation_requests
  for each row execute function public.guard_vacation_changes();

-- Saldo en días hábiles y respetando RLS de quien consulta
drop view public.vacation_balances;

create or replace function public.business_days(p_start date, p_end date)
returns int
language sql
immutable
as $$
  select count(*)::int
  from generate_series(p_start, p_end, interval '1 day') d
  where extract(isodow from d) < 6;
$$;

create view public.vacation_balances
with (security_invoker = true) as
select
  m.id as membership_id,
  m.org_id,
  m.annual_vacation_days as allowance,
  extract(year from current_date)::int as year,
  coalesce(sum(public.business_days(vr.start_date, vr.end_date))
    filter (where vr.status = 'approved'), 0)::int as used_days,
  coalesce(sum(public.business_days(vr.start_date, vr.end_date))
    filter (where vr.status = 'pending'), 0)::int as pending_days
from public.memberships m
left join public.vacation_requests vr
  on vr.membership_id = m.id
  and extract(year from vr.start_date) = extract(year from current_date)
group by m.id, m.org_id, m.annual_vacation_days;

-- ------------------------------------------------------------
-- invitations: alta de empleados por email
-- ------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role_id text not null default 'employee' references public.roles (id),
  manager_id uuid references public.memberships (id) on delete set null,
  position text,
  invited_by uuid references public.memberships (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (role_id <> 'owner')
);

create unique index invitations_one_pending_per_email
  on public.invitations (org_id, lower(email))
  where accepted_at is null;

alter table public.invitations enable row level security;

create policy "invitations: select as admin or invitee"
  on public.invitations for select
  using (
    public.has_permission(org_id, 'employees.manage')
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

create policy "invitations: insert with employees.manage"
  on public.invitations for insert
  with check (public.has_permission(org_id, 'employees.manage'));

create policy "invitations: delete with employees.manage"
  on public.invitations for delete
  using (public.has_permission(org_id, 'employees.manage') and accepted_at is null);

create or replace function public.guard_invitation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_level smallint;
  v_new_level smallint;
begin
  select r.level into v_my_level
  from public.memberships m join public.roles r on r.id = m.role_id
  where m.org_id = new.org_id and m.user_id = auth.uid() and m.status = 'active';
  select level into v_new_level from public.roles where id = new.role_id;

  if v_my_level < 4 and v_new_level >= v_my_level then
    raise exception 'cannot invite with a rank equal or higher than yours';
  end if;
  if new.manager_id is not null and public.membership_org(new.manager_id) <> new.org_id then
    raise exception 'manager must belong to the same organization';
  end if;
  new.email := lower(trim(new.email));
  new.invited_by := public.my_membership_id(new.org_id);
  return new;
end;
$$;

create trigger trg_invitations_guard
  before insert on public.invitations
  for each row execute function public.guard_invitation_insert();

-- El invitado necesita ver el nombre de la org antes de aceptar
create policy "organizations: select if invited"
  on public.organizations for select
  using (exists (
    select 1 from public.invitations i
    where i.org_id = organizations.id
      and i.accepted_at is null
      and lower(i.email) = lower(auth.jwt() ->> 'email')
  ));

create or replace function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
  v_membership_id uuid;
begin
  select * into v_inv from public.invitations
  where id = p_invitation_id
    and accepted_at is null
    and lower(email) = lower(auth.jwt() ->> 'email');

  if not found then
    raise exception 'invitation not found';
  end if;

  insert into public.memberships (org_id, user_id, role_id, manager_id, position)
  values (v_inv.org_id, auth.uid(), v_inv.role_id, v_inv.manager_id, v_inv.position)
  on conflict (org_id, user_id) do update set status = 'active'
  returning id into v_membership_id;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_membership_id;
end;
$$;

-- ------------------------------------------------------------
-- audit_log: scope por organización (admins ven la auditoría de su org)
-- ------------------------------------------------------------
-- Sin FK a propósito: el log debe sobrevivir al borrado de la organización
-- (y una FK haría fallar el borrado en cascada, que dispara este mismo trigger).
alter table public.audit_log add column org_id uuid;
create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);

create or replace function audit.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_org uuid;
begin
  v_org := coalesce(
    (v_row ->> 'org_id')::uuid,
    public.membership_org((v_row ->> 'membership_id')::uuid)
  );

  insert into public.audit_log (user_id, org_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    v_org,
    TG_OP,
    TG_TABLE_NAME,
    v_row ->> 'id',
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.log_event(
  p_action text,
  p_metadata jsonb default '{}'::jsonb,
  p_org_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_org_id is not null and not public.is_org_member(p_org_id) then
    raise exception 'not a member of this organization';
  end if;
  insert into public.audit_log (user_id, org_id, action, metadata)
  values (auth.uid(), p_org_id, p_action, p_metadata);
end;
$$;

drop function public.log_event(text, jsonb);

drop policy "audit_log: select own" on public.audit_log;
create policy "audit_log: select own or org admin"
  on public.audit_log for select
  using (
    user_id = auth.uid()
    or (org_id is not null and public.has_permission(org_id, 'employees.manage'))
  );

create trigger trg_audit_projects
  after insert or update or delete on public.projects
  for each row execute function audit.log_change();

create trigger trg_audit_invitations
  after insert or update or delete on public.invitations
  for each row execute function audit.log_change();

-- ------------------------------------------------------------
-- Índices para las consultas habituales
-- ------------------------------------------------------------
create index memberships_user_idx on public.memberships (user_id);
create index memberships_manager_idx on public.memberships (manager_id);
create index time_entries_membership_started_idx on public.time_entries (membership_id, started_at desc);
create index time_entries_task_idx on public.time_entries (task_id);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assigned_idx on public.tasks (assigned_to);
create index vacation_requests_membership_idx on public.vacation_requests (membership_id, start_date);
