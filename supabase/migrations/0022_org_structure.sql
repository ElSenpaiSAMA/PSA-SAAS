-- ============================================================
-- 0022 · Estructura de la empresa: niveles, ramas y rol en cada proyecto
--
-- Dos estructuras que conviven (organización matricial):
--
--   1. ORGANIZACIÓN (quién depende de quién) → gestiona PERSONAS
--      Nivel (roles.level) de mayor a menor:
--        8 superadmin   plataforma (el desarrollador): todo, oculto en la empresa
--        7 owner        CEO: toda la empresa
--        6 director     dirección de rama (memberships.directs_branch_id)
--        5 manager      responsable de departamento (departments.head_id)
--        4 coordinator  coordinador / encargado: su grupo (manager_id)
--        3 employee     equipo: lo suyo
--        2 intern       aprendiz: lo suyo, imputa solo en sus tareas
--        1 external     externo: lo suyo, sin foro ni directorio ni calendario
--      Ramas (branches) agrupan departamentos. Qué gestiona una rama o un
--      departamento a nivel empresa (p. ej. RRHH → personas) se define con
--      branch_permissions / department_permissions: lo reciben su director
--      o su responsable.
--
--   2. TRABAJO (rol en cada proyecto, project_members.role)
--        lead      responsable: gestiona el proyecto y sus OT e invita gente
--        member    ve el proyecto y sus OT, e imputa horas
--        observer  solo mira
--
-- has_permission() junta todo: rol + rama que dirige + departamentos que
-- encabeza (owner y superadmin: todo). Las políticas RLS existentes no
-- cambian: preguntan por permisos y ahora la respuesta es más fina.
-- ============================================================

-- ------------------------------------------------------------
-- 1 · Niveles
-- ------------------------------------------------------------
insert into public.roles (id, name, level) values
  ('superadmin', 'Superadmin', 8),
  ('director', 'Dirección de rama', 6),
  ('coordinator', 'Coordinador / Encargado', 4),
  ('intern', 'Aprendiz', 2),
  ('external', 'Externo', 1)
on conflict (id) do nothing;

update public.roles set name = 'CEO', level = 7 where id = 'owner';
update public.roles set name = 'Responsable de departamento', level = 5 where id = 'manager';
update public.roles set name = 'Empleado', level = 3 where id = 'employee';

insert into public.permissions (key, description) values
  ('planning.view', 'Ver la planificación (de las personas que supervisa)'),
  ('people.view', 'Ver las fichas de su equipo (sin datos sensibles)'),
  ('workspace.access', 'Foro, calendario y directorio de la empresa (todos menos externos)')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 2 · Ramas
-- ------------------------------------------------------------
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  color text not null default 'blue' check (color in ('blue', 'green', 'violet', 'amber', 'rose', 'teal')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

alter table public.departments add column branch_id uuid references public.branches (id) on delete set null;
alter table public.memberships add column directs_branch_id uuid references public.branches (id) on delete set null;
alter table public.invitations add column directs_branch_id uuid references public.branches (id) on delete set null;

-- Qué gestiona a nivel empresa quien dirige la rama / encabeza el departamento
create table public.branch_permissions (
  branch_id uuid not null references public.branches (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (branch_id, permission_key)
);

create table public.department_permissions (
  department_id uuid not null references public.departments (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (department_id, permission_key)
);

-- ------------------------------------------------------------
-- 3 · Resolución de permisos
-- ------------------------------------------------------------
create or replace function public.membership_can(p_membership_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select m.* from public.memberships m where m.id = p_membership_id and m.status = 'active'
  )
  select
    exists (select 1 from me where me.role_id in ('superadmin', 'owner'))
    or exists (
      select 1 from me join public.role_permissions rp on rp.role_id = me.role_id
      where rp.permission_key = p_permission
    )
    or exists (
      select 1 from me join public.branch_permissions bp on bp.branch_id = me.directs_branch_id
      where me.role_id = 'director' and bp.permission_key = p_permission
    )
    or exists (
      select 1 from me
      join public.departments d on d.head_id = me.id
      join public.department_permissions dp on dp.department_id = d.id
      where dp.permission_key = p_permission
    );
$$;

create or replace function public.has_permission(p_org_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.membership_can(public.my_membership_id(p_org_id), p_key), false);
$$;

-- Todos los permisos efectivos de quien consulta (la app arma el menú con esto)
create or replace function public.my_permissions(p_org_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.key from public.permissions p where public.has_permission(p_org_id, p.key);
$$;

grant execute on function public.my_permissions(uuid) to authenticated;

-- ¿Quién consulta dirige la rama a la que pertenece esa persona (por su departamento)?
create or replace function public.directs_branch_of(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships target
    join public.departments d on d.id = target.department_id
    join public.memberships me on me.org_id = target.org_id and me.user_id = auth.uid() and me.status = 'active'
    where target.id = p_membership_id
      and me.role_id = 'director'
      and d.branch_id is not null
      and d.branch_id = me.directs_branch_id
  );
$$;

-- Supervisar = tener el permiso y alcance sobre esa persona: RRHH (toda la empresa),
-- su línea de reporte, su departamento (si lo encabeza) o su rama (si la dirige)
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
      or public.is_in_reporting_line(public.my_membership_id(public.membership_org(p_membership_id)), p_membership_id)
      or exists (
        select 1 from public.memberships t
        where t.id = p_membership_id and t.department_id is not null and public.is_department_head(t.department_id)
      )
      or public.directs_branch_of(p_membership_id)
    );
$$;

-- Permisos base de cada nivel (la rama y el departamento suman los de su función)
delete from public.role_permissions where role_id in ('manager', 'employee');
insert into public.role_permissions (role_id, permission_key) values
  ('director', 'time.view_team'), ('director', 'vacations.approve'), ('director', 'planning.view'),
  ('director', 'people.view'), ('director', 'workspace.access'),
  ('manager', 'time.view_team'), ('manager', 'vacations.approve'), ('manager', 'planning.view'),
  ('manager', 'people.view'), ('manager', 'workspace.access'),
  ('coordinator', 'time.view_team'), ('coordinator', 'planning.view'), ('coordinator', 'people.view'),
  ('coordinator', 'workspace.access'),
  ('employee', 'workspace.access'),
  ('intern', 'workspace.access')
on conflict do nothing;

-- ------------------------------------------------------------
-- 4 · Datos existentes: el viejo "admin" pasa a dirigir la rama de Administración y RRHH,
-- que conserva todo lo que el admin podía hacer
-- ------------------------------------------------------------
insert into public.branches (org_id, name, color)
select distinct m.org_id, 'Administración y RRHH', 'violet'
from public.memberships m where m.role_id = 'admin'
union
select distinct i.org_id, 'Administración y RRHH', 'violet'
from public.invitations i where i.role_id = 'admin'
on conflict (org_id, name) do nothing;

insert into public.branch_permissions (branch_id, permission_key)
select b.id, rp.permission_key
from public.branches b
join public.role_permissions rp on rp.role_id = 'admin'
where b.name = 'Administración y RRHH'
on conflict do nothing;

insert into public.branch_permissions (branch_id, permission_key)
select b.id, k from public.branches b, unnest(array['contact.manage', 'forum.moderate', 'people.view', 'planning.view']) k
where b.name = 'Administración y RRHH'
on conflict do nothing;

update public.memberships m
set role_id = 'director', directs_branch_id = b.id
from public.branches b
where m.role_id = 'admin' and b.org_id = m.org_id and b.name = 'Administración y RRHH';

update public.invitations i
set role_id = 'director', directs_branch_id = b.id
from public.branches b
where i.role_id = 'admin' and b.org_id = i.org_id and b.name = 'Administración y RRHH';

delete from public.role_permissions where role_id = 'admin';
delete from public.roles where id = 'admin';

-- Nadie invita a alguien como CEO ni como superadmin
alter table public.invitations drop constraint if exists invitations_role_id_check;
alter table public.invitations add constraint invitations_role_id_check check (role_id not in ('owner', 'superadmin'));

-- ------------------------------------------------------------
-- 5 · RLS de las tablas nuevas
-- ------------------------------------------------------------
alter table public.branches enable row level security;
alter table public.branch_permissions enable row level security;
alter table public.department_permissions enable row level security;

create policy "branches: select if member" on public.branches for select using (public.is_org_member(org_id));
create policy "branches: write with departments.manage" on public.branches for all
  using (public.has_permission(org_id, 'departments.manage'))
  with check (public.has_permission(org_id, 'departments.manage'));

-- Asignar permisos de empresa a una rama o departamento es lo más delicado
-- (podría darse poder a sí mismo): solo el CEO o el superadmin
create or replace function public.is_top_level(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id and m.user_id = auth.uid() and m.status = 'active' and m.role_id in ('owner', 'superadmin')
  );
$$;

create policy "branch_permissions: select if member" on public.branch_permissions for select
  using (exists (select 1 from public.branches b where b.id = branch_id and public.is_org_member(b.org_id)));
create policy "branch_permissions: write if top level" on public.branch_permissions for all
  using (exists (select 1 from public.branches b where b.id = branch_id and public.is_top_level(b.org_id)))
  with check (exists (select 1 from public.branches b where b.id = branch_id and public.is_top_level(b.org_id)));

create policy "department_permissions: select if member" on public.department_permissions for select
  using (exists (select 1 from public.departments d where d.id = department_id and public.is_org_member(d.org_id)));
create policy "department_permissions: write if top level" on public.department_permissions for all
  using (exists (select 1 from public.departments d where d.id = department_id and public.is_top_level(d.org_id)))
  with check (exists (select 1 from public.departments d where d.id = department_id and public.is_top_level(d.org_id)));

create trigger trg_audit_branches after insert or update or delete on public.branches
  for each row execute function audit.log_change();

-- ------------------------------------------------------------
-- 6 · Guard de memberships con los niveles nuevos
-- ------------------------------------------------------------
create or replace function public.guard_membership_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_role text;
  v_my_level smallint;
  v_old_level smallint;
  v_new_level smallint;
begin
  -- Solo quien dirige una rama tiene rama, y tiene que ser de la misma empresa
  if new.role_id <> 'director' then
    new.directs_branch_id := null;
  elsif new.directs_branch_id is not null
     and (select org_id from public.branches where id = new.directs_branch_id) <> new.org_id then
    raise exception 'branch must belong to the same organization';
  end if;

  -- Llamadas desde funciones internas/servicio (sin usuario) no se restringen
  if auth.uid() is null then
    return new;
  end if;

  select m.role_id, r.level into v_my_role, v_my_level
  from public.memberships m join public.roles r on r.id = m.role_id
  where m.org_id = new.org_id and m.user_id = auth.uid() and m.status = 'active';

  if new.user_id = auth.uid()
     and (new.role_id <> old.role_id or new.status <> old.status or new.directs_branch_id is distinct from old.directs_branch_id) then
    raise exception 'cannot change your own role or status';
  end if;

  -- El superadmin (plataforma) no se crea ni se toca desde la empresa
  if (old.role_id = 'superadmin' or new.role_id = 'superadmin') and v_my_role is distinct from 'superadmin' then
    raise exception 'superadmin is managed by the platform';
  end if;

  select level into v_old_level from public.roles where id = old.role_id;
  select level into v_new_level from public.roles where id = new.role_id;

  -- No se gestiona a alguien de nivel igual o superior, ni se asigna un nivel >= al propio
  -- (el CEO y el superadmin pueden todo dentro de la empresa)
  if v_my_role not in ('owner', 'superadmin') and (v_old_level >= v_my_level or v_new_level >= v_my_level) then
    raise exception 'insufficient rank for this change';
  end if;

  if new.manager_id is not null and public.membership_org(new.manager_id) <> new.org_id then
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

-- Al insertar (alta por invitación o seed) también se valida la rama
create or replace function public.guard_membership_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id <> 'director' then
    new.directs_branch_id := null;
  elsif new.directs_branch_id is not null
     and (select org_id from public.branches where id = new.directs_branch_id) <> new.org_id then
    raise exception 'branch must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger trg_memberships_branch_insert
  before insert on public.memberships
  for each row execute function public.guard_membership_branch();

-- Las invitaciones llevan la rama si es para dirigir una
create or replace function public.accept_invitations_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  for v_inv in
    select * from public.invitations
    where lower(email) = lower(new.email) and accepted_at is null
  loop
    insert into public.memberships (org_id, user_id, role_id, manager_id, position, department_id, directs_branch_id)
    values (v_inv.org_id, new.id, v_inv.role_id, v_inv.manager_id, v_inv.position, v_inv.department_id, v_inv.directs_branch_id)
    on conflict (org_id, user_id) do update set status = 'active';
    update public.invitations set accepted_at = now() where id = v_inv.id;
  end loop;
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

  insert into public.memberships (org_id, user_id, role_id, manager_id, position, department_id, directs_branch_id)
  values (v_inv.org_id, auth.uid(), v_inv.role_id, v_inv.manager_id, v_inv.position, v_inv.department_id, v_inv.directs_branch_id)
  on conflict (org_id, user_id) do update set status = 'active'
  returning id into v_membership_id;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_membership_id;
end;
$$;

-- ------------------------------------------------------------
-- 7 · Rol en cada proyecto
-- ------------------------------------------------------------
alter table public.project_members
  add column role text not null default 'member' check (role in ('lead', 'member', 'observer')),
  add column added_by uuid references public.memberships (id) on delete set null;

create or replace function public.is_project_lead(p_project_id uuid)
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
    where pm.project_id = p_project_id and pm.role = 'lead' and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- Gestionar un proyecto: permiso de empresa (oficina técnica, dirección…), responsable del
-- departamento, director de su rama, o responsable del propio proyecto
create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    left join public.departments d on d.id = p.department_id
    where p.id = p_project_id
      and (
        public.has_permission(p.org_id, 'projects.manage')
        or (p.department_id is not null and public.is_department_head(p.department_id))
        or (
          d.branch_id is not null and exists (
            select 1 from public.memberships me
            where me.org_id = p.org_id and me.user_id = auth.uid() and me.status = 'active'
              and me.role_id = 'director' and me.directs_branch_id = d.branch_id
          )
        )
        or public.is_project_lead(p.id)
      )
  );
$$;

-- Quién invita y con qué rol: el responsable de un proyecto suma miembros y observadores;
-- nombrar responsables queda para quien gestiona por encima del proyecto
create or replace function public.guard_project_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := (select org_id from public.projects where id = new.project_id);
begin
  if public.membership_org(new.membership_id) <> v_org then
    raise exception 'member must belong to the same organization';
  end if;
  if auth.uid() is not null then
    new.added_by := coalesce(new.added_by, public.my_membership_id(v_org));
    if new.role = 'lead'
       and (tg_op = 'INSERT' or old.role is distinct from 'lead')
       and public.is_project_lead(new.project_id)
       and not (
         public.has_permission(v_org, 'projects.manage')
         or exists (
           select 1 from public.projects p
           where p.id = new.project_id and p.department_id is not null and public.is_department_head(p.department_id)
         )
       ) then
      raise exception 'only managers above the project can appoint a lead';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_members_guard on public.project_members;
create trigger trg_project_members_guard
  before insert or update on public.project_members
  for each row execute function public.guard_project_member();

create policy "project_members: update if can manage project"
  on public.project_members for update
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

-- Imputar horas en una tarea: hay que estar en el proyecto (no como observador) o gestionarlo,
-- y un aprendiz solo en las tareas que tiene asignadas
create or replace function public.guard_task_time_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_role text;
begin
  if new.entry_type <> 'task' or new.task_id is null or auth.uid() is null then
    return new;
  end if;
  select * into v_task from public.tasks where id = new.task_id;
  select role_id into v_role from public.memberships where id = new.membership_id;

  if v_role = 'intern' and v_task.assigned_to is distinct from new.membership_id then
    raise exception 'interns can only log hours on their own tasks';
  end if;
  if exists (
    select 1 from public.project_members pm
    where pm.project_id = v_task.project_id and pm.membership_id = new.membership_id and pm.role = 'observer'
  ) and not public.can_manage_project(v_task.project_id) then
    raise exception 'observers cannot log hours';
  end if;
  return new;
end;
$$;

create trigger trg_time_entries_project_role
  before insert on public.time_entries
  for each row execute function public.guard_task_time_entry();

-- ------------------------------------------------------------
-- 8 · Qué ve cada uno de las personas y del trabajo de la empresa
-- ------------------------------------------------------------

-- ¿Comparto algún proyecto con esa persona? (lo único que ve un externo de los demás)
create or replace function public.shares_project_with(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.memberships me on me.id = mine.membership_id and me.user_id = auth.uid()
    join public.project_members theirs on theirs.project_id = mine.project_id
    where theirs.membership_id = p_membership_id
  );
$$;

drop policy "memberships: select within own org" on public.memberships;
create policy "memberships: select within own org"
  on public.memberships for select
  using (
    user_id = auth.uid()
    or (
      public.is_org_member(org_id)
      and (public.has_permission(org_id, 'workspace.access') or public.shares_project_with(id))
    )
  );

drop policy "profiles: select coworkers" on public.profiles;
create policy "profiles: select coworkers"
  on public.profiles for select
  using (exists (
    select 1 from public.memberships them
    where them.user_id = profiles.id
      and public.is_org_member(them.org_id)
      and (public.has_permission(them.org_id, 'workspace.access') or public.shares_project_with(them.id))
  ));

-- Foro: toda la empresa menos los externos
drop policy "forum_threads: select if member" on public.forum_threads;
create policy "forum_threads: select if member" on public.forum_threads for select
  using (public.has_permission(org_id, 'workspace.access'));
drop policy "forum_posts: select if member" on public.forum_posts;
create policy "forum_posts: select if member" on public.forum_posts for select
  using (public.has_permission(org_id, 'workspace.access'));
drop policy "forum_threads: insert own" on public.forum_threads;
create policy "forum_threads: insert own" on public.forum_threads for insert
  with check (public.is_own_membership(author_id) and public.has_permission(org_id, 'workspace.access'));
drop policy "forum_posts: insert own" on public.forum_posts;
create policy "forum_posts: insert own" on public.forum_posts for insert
  with check (public.is_own_membership(author_id) and public.has_permission(org_id, 'workspace.access'));

-- Calendario: las ausencias aprobadas de mi departamento (o de quienes supervisa / RRHH),
-- las mías y, si están pendientes, las que me toca aprobar. Un externo solo ve las suyas.
create or replace function public.org_absences(p_org_id uuid, p_from date, p_to date)
returns table (membership_id uuid, start_date date, end_date date, status text)
language sql
stable
security definer
set search_path = public
as $$
  select vr.membership_id, vr.start_date, vr.end_date, vr.status
  from public.vacation_requests vr
  join public.memberships m on m.id = vr.membership_id
  where m.org_id = p_org_id
    and m.status = 'active'
    and vr.start_date <= p_to
    and vr.end_date >= p_from
    and public.is_org_member(p_org_id)
    and (
      public.is_own_membership(vr.membership_id)
      or (
        vr.status = 'approved'
        and (
          public.can_supervise(vr.membership_id, 'vacations.approve')
          or public.has_permission(p_org_id, 'employees.manage')
          or (
            public.has_permission(p_org_id, 'workspace.access')
            and m.department_id is not null
            and m.department_id = (select department_id from public.memberships where id = public.my_membership_id(p_org_id))
          )
        )
      )
      or (vr.status = 'pending' and public.can_supervise(vr.membership_id, 'vacations.approve'))
    );
$$;

-- Los avisos del foro le llegan a quien puede leer el foro (los externos no)
create or replace function public.notify_forum_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  if new.category <> 'notice' then
    return null;
  end if;
  for v_member in
    select id from public.memberships
    where org_id = new.org_id and status = 'active' and public.membership_can(id, 'workspace.access')
  loop
    if v_member is distinct from new.author_id and not (v_member = any (new.mentions)) then
      perform public.notify(new.org_id, v_member, 'forum.notice', 'Nuevo aviso: ' || new.title,
        left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
        '/app/' || new.org_id || '/forum/' || new.id, 'forum_thread', new.id);
    end if;
  end loop;
  return null;
end;
$$;

-- Quién aprueba las vacaciones: igual que antes, pero el superadmin (plataforma) nunca
-- interviene en la gestión de la empresa
create or replace function public.vacation_approvers(p_membership_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_current uuid := (select manager_id from public.memberships where id = p_membership_id);
  v_depth int := 0;
  v_org uuid := public.membership_org(p_membership_id);
begin
  if auth.uid() is not null and not public.is_org_member(v_org) then
    return;
  end if;
  while v_current is not null and v_depth < 20 loop
    if public.membership_can(v_current, 'vacations.approve')
       and (select role_id from public.memberships where id = v_current) <> 'superadmin' then
      return next v_current;
      return;
    end if;
    v_current := (select manager_id from public.memberships where id = v_current);
    v_depth := v_depth + 1;
  end loop;
  return query
    select m.id from public.memberships m
    where m.org_id = v_org and m.status = 'active' and m.id <> p_membership_id
      and m.role_id <> 'superadmin'
      and public.membership_can(m.id, 'employees.manage')
      and public.membership_can(m.id, 'vacations.approve');
end;
$$;
