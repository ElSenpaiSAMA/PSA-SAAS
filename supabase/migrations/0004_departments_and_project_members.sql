-- ============================================================
-- 0004_departments_and_project_members.sql
-- Departamentos con responsable y proyectos con miembros explícitos.
--
-- Visibilidad de proyectos (y de sus tareas y horas):
--   * owner/admin (projects.manage): toda la organización
--   * responsable de departamento: todos los proyectos de su departamento
--   * resto: solo los proyectos donde es miembro
-- Asignar a alguien a un departamento hace que su manager sea el responsable.
-- ============================================================

-- ------------------------------------------------------------
-- departments
-- ------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  head_id uuid references public.memberships (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

-- Una persona encabeza como mucho un departamento
create unique index departments_one_per_head on public.departments (head_id) where head_id is not null;
create index departments_org_idx on public.departments (org_id);

alter table public.memberships add column department_id uuid references public.departments (id) on delete set null;
alter table public.invitations add column department_id uuid references public.departments (id) on delete set null;
alter table public.projects add column department_id uuid references public.departments (id) on delete set null;

create index memberships_department_idx on public.memberships (department_id);
create index projects_department_idx on public.projects (department_id);

insert into public.permissions (key, description) values
  ('departments.manage', 'Crear departamentos, asignar responsables y mover personas entre departamentos');
insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'departments.manage'),
  ('admin', 'departments.manage');

create or replace function public.department_org(p_department_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.departments where id = p_department_id;
$$;

create or replace function public.is_department_head(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.departments d
    join public.memberships m on m.id = d.head_id
    where d.id = p_department_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

alter table public.departments enable row level security;

create policy "departments: select within own org"
  on public.departments for select
  using (public.is_org_member(org_id));

create policy "departments: insert with departments.manage"
  on public.departments for insert
  with check (public.has_permission(org_id, 'departments.manage'));

create policy "departments: update with departments.manage"
  on public.departments for update
  using (public.has_permission(org_id, 'departments.manage'))
  with check (public.has_permission(org_id, 'departments.manage'));

create policy "departments: delete with departments.manage"
  on public.departments for delete
  using (public.has_permission(org_id, 'departments.manage'));

create or replace function public.guard_department_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.name := trim(new.name);
  if tg_op = 'UPDATE' and new.org_id <> old.org_id then
    raise exception 'org_id is immutable';
  end if;
  if new.head_id is not null and public.membership_org(new.head_id) <> new.org_id then
    raise exception 'department head must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger trg_departments_guard
  before insert or update on public.departments
  for each row execute function public.guard_department_changes();

-- ------------------------------------------------------------
-- Sincronización departamento → manager
-- ------------------------------------------------------------

-- Los cambios derivados (no los hace el usuario a mano) saltean el guard de rangos.
-- Solo se activa desde funciones security definer, dentro de la transacción.
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
  if auth.uid() is null or current_setting('app.department_sync', true) = 'on' then
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

  if v_my_level < 4 and (v_old_level >= v_my_level or v_new_level >= v_my_level) then
    raise exception 'insufficient rank for this change';
  end if;

  if new.manager_id is not null
     and public.membership_org(new.manager_id) <> new.org_id then
    raise exception 'manager must belong to the same organization';
  end if;

  if new.department_id is not null
     and public.department_org(new.department_id) <> new.org_id then
    raise exception 'department must belong to the same organization';
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

-- Al entrar o cambiar de departamento, el manager pasa a ser el responsable
-- (salvo que sea el propio responsable, o que el responsable le reporte a esta persona).
create or replace function public.membership_department_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_head uuid;
begin
  if new.department_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.department_id is not distinct from old.department_id then
    return new;
  end if;

  select head_id into v_head from public.departments where id = new.department_id;
  if v_head is not null
     and v_head <> new.id
     and (tg_op = 'INSERT' or not public.is_in_reporting_line(new.id, v_head)) then
    new.manager_id := v_head;
  end if;
  return new;
end;
$$;

create trigger trg_memberships_department
  before insert or update of department_id on public.memberships
  for each row execute function public.membership_department_manager();

-- Al asignar (o cambiar) el responsable: queda dentro del departamento, sube a manager
-- si tenía un rango menor, y pasa a ser el manager de los miembros.
create or replace function public.department_head_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.head_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.head_id is not distinct from old.head_id then
    return new;
  end if;

  perform set_config('app.department_sync', 'on', true);

  update public.memberships set department_id = new.id
  where id = new.head_id and department_id is distinct from new.id;

  update public.memberships set role_id = 'manager'
  where id = new.head_id and role_id = 'employee';

  update public.memberships m set manager_id = new.head_id
  where m.department_id = new.id
    and m.id <> new.head_id
    and not public.is_in_reporting_line(m.id, new.head_id);

  perform set_config('app.department_sync', 'off', true);
  return new;
end;
$$;

create trigger trg_departments_head_sync
  after insert or update of head_id on public.departments
  for each row execute function public.department_head_sync();

-- ------------------------------------------------------------
-- Invitaciones con departamento
-- ------------------------------------------------------------
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
  if new.department_id is not null and public.department_org(new.department_id) <> new.org_id then
    raise exception 'department must belong to the same organization';
  end if;
  new.email := lower(trim(new.email));
  new.invited_by := public.my_membership_id(new.org_id);
  return new;
end;
$$;

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

  insert into public.memberships (org_id, user_id, role_id, manager_id, position, department_id)
  values (v_inv.org_id, auth.uid(), v_inv.role_id, v_inv.manager_id, v_inv.position, v_inv.department_id)
  on conflict (org_id, user_id) do update set status = 'active'
  returning id into v_membership_id;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_membership_id;
end;
$$;

-- ------------------------------------------------------------
-- project_members
-- ------------------------------------------------------------
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, membership_id)
);

create index project_members_membership_idx on public.project_members (membership_id);

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.memberships m on m.id = pm.membership_id
    where pm.project_id = p_project_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        public.has_permission(p.org_id, 'projects.manage')
        or (p.department_id is not null and public.is_department_head(p.department_id))
      )
  );
$$;

create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_project(p_project_id) or public.is_project_member(p_project_id);
$$;

alter table public.project_members enable row level security;

create policy "project_members: select if project visible"
  on public.project_members for select
  using (public.can_view_project(project_id));

create policy "project_members: insert if can manage project"
  on public.project_members for insert
  with check (public.can_manage_project(project_id));

create policy "project_members: delete if can manage project"
  on public.project_members for delete
  using (public.can_manage_project(project_id));

create or replace function public.guard_project_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.membership_org(new.membership_id) <> (select org_id from public.projects where id = new.project_id) then
    raise exception 'member must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger trg_project_members_guard
  before insert on public.project_members
  for each row execute function public.guard_project_member();

create trigger trg_audit_project_members
  after insert or delete on public.project_members
  for each row execute function audit.log_change();

-- ------------------------------------------------------------
-- projects: visibilidad por membresía / departamento
-- ------------------------------------------------------------
drop policy "projects: select within own org" on public.projects;
drop policy "projects: manage with projects.manage permission" on public.projects;

create policy "projects: select if visible"
  on public.projects for select
  using (public.can_view_project(id));

create policy "projects: insert as admin or department head"
  on public.projects for insert
  with check (
    public.has_permission(org_id, 'projects.manage')
    or (department_id is not null and public.is_department_head(department_id))
  );

create policy "projects: update if can manage"
  on public.projects for update
  using (public.can_manage_project(id))
  with check (
    public.has_permission(org_id, 'projects.manage')
    or (department_id is not null and public.is_department_head(department_id))
  );

create policy "projects: delete as admin"
  on public.projects for delete
  using (public.has_permission(org_id, 'projects.manage'));

create or replace function public.guard_project_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.department_id is not null and public.department_org(new.department_id) <> new.org_id then
    raise exception 'department must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger trg_projects_department_guard
  before insert or update on public.projects
  for each row execute function public.guard_project_department();

-- ------------------------------------------------------------
-- tasks: misma visibilidad que su proyecto; asignado = miembro
-- ------------------------------------------------------------
drop policy "tasks: select within own org" on public.tasks;
drop policy "tasks: update assigned or manage_all" on public.tasks;
drop policy "tasks: insert with manage_all" on public.tasks;
drop policy "tasks: delete with manage_all" on public.tasks;

create policy "tasks: select if project visible"
  on public.tasks for select
  using (public.can_view_project(project_id));

create policy "tasks: update assigned or project manager"
  on public.tasks for update
  using (public.is_own_membership(assigned_to) or public.can_manage_project(project_id));

create policy "tasks: insert if can manage project"
  on public.tasks for insert
  with check (public.can_manage_project(project_id));

create policy "tasks: delete if can manage project"
  on public.tasks for delete
  using (public.can_manage_project(project_id));

create or replace function public.guard_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.can_manage_project(new.project_id) then
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

-- Asignar una tarea suma a la persona como miembro del proyecto
create or replace function public.tasks_sync_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select org_id into new.org_id from public.projects where id = new.project_id;
  if new.assigned_to is not null then
    if public.membership_org(new.assigned_to) <> new.org_id then
      raise exception 'assignee must belong to the same organization';
    end if;
    insert into public.project_members (project_id, membership_id)
    values (new.project_id, new.assigned_to)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- time_entries: solo se imputan horas a proyectos visibles
-- ------------------------------------------------------------
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
  if new.task_id is not null and auth.uid() is not null
     and not public.can_view_project((select project_id from public.tasks where id = new.task_id)) then
    raise exception 'not a member of this project';
  end if;
  if new.entry_type = 'clock' and auth.uid() is not null then
    new.started_at := now();
    new.ended_at := null;
  end if;
  return new;
end;
$$;

-- Horas agregadas: solo de proyectos que el usuario puede ver
create or replace function public.task_logged_minutes(p_org_id uuid)
returns table (task_id uuid, minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    te.task_id,
    sum(extract(epoch from (coalesce(te.ended_at, now()) - te.started_at)) / 60)::integer as minutes
  from public.time_entries te
  join public.tasks t on t.id = te.task_id
  where t.org_id = p_org_id
    and te.entry_type = 'task'
    and public.is_org_member(p_org_id)
    and public.can_view_project(t.project_id)
  group by te.task_id;
$$;

-- ------------------------------------------------------------
-- Datos existentes: quien tiene tareas en un proyecto pasa a ser miembro
-- ------------------------------------------------------------
insert into public.project_members (project_id, membership_id)
select distinct t.project_id, t.assigned_to
from public.tasks t
where t.assigned_to is not null
on conflict do nothing;

create trigger trg_audit_departments
  after insert or update or delete on public.departments
  for each row execute function audit.log_change();
