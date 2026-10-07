-- ============================================================
-- 0023 · Superadmin de plataforma y registro de errores
--
-- El superadmin (el desarrollador) deja de ver la gestión de la empresa:
--   · audit.view      → Auditoría (también la tienen el CEO y quien gestiona personas)
--   · platform.manage → configurar qué gestiona cada rama y departamento, y el
--                       registro de errores. Solo el superadmin.
-- Configurar los permisos de ramas y departamentos pasa del CEO al superadmin:
-- es configuración de la plataforma, no gestión del día a día.
--
-- error_logs: tabla aparte con los errores de la app (servidor, acciones y
-- navegador). Cualquiera puede reportar (log_error, con límites de tamaño y
-- frecuencia); solo el superadmin los lee y los marca como resueltos.
-- ============================================================

insert into public.permissions (key, description) values
  ('audit.view', 'Ver la auditoría de la empresa'),
  ('platform.manage', 'Plataforma: estructura de permisos por rama y departamento, y registro de errores')
on conflict (key) do nothing;

-- ── El superadmin solo tiene lo de plataforma ────────────────
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
    -- El CEO tiene todo lo de la empresa, pero no lo de plataforma
    exists (select 1 from me where me.role_id = 'owner' and p_permission <> 'platform.manage')
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

delete from public.role_permissions where role_id = 'superadmin';
insert into public.role_permissions (role_id, permission_key) values
  ('superadmin', 'audit.view'),
  ('superadmin', 'platform.manage')
on conflict do nothing;

-- Quien gestiona personas (RRHH) sigue viendo la auditoría
insert into public.branch_permissions (branch_id, permission_key)
select branch_id, 'audit.view' from public.branch_permissions where permission_key = 'employees.manage'
on conflict do nothing;
insert into public.department_permissions (department_id, permission_key)
select department_id, 'audit.view' from public.department_permissions where permission_key = 'employees.manage'
on conflict do nothing;

drop policy "audit_log: select own or org admin" on public.audit_log;
create policy "audit_log: select own or with audit.view"
  on public.audit_log for select
  using (
    user_id = auth.uid()
    or (org_id is not null and public.has_permission(org_id, 'audit.view'))
  );

-- La auditoría necesita los nombres de las personas: quien la ve, ve el directorio
drop policy "memberships: select within own org" on public.memberships;
create policy "memberships: select within own org"
  on public.memberships for select
  using (
    user_id = auth.uid()
    or (
      public.is_org_member(org_id)
      and (
        public.has_permission(org_id, 'workspace.access')
        or public.has_permission(org_id, 'audit.view')
        or public.shares_project_with(id)
      )
    )
  );

drop policy "profiles: select coworkers" on public.profiles;
create policy "profiles: select coworkers"
  on public.profiles for select
  using (exists (
    select 1 from public.memberships them
    where them.user_id = profiles.id
      and public.is_org_member(them.org_id)
      and (
        public.has_permission(them.org_id, 'workspace.access')
        or public.has_permission(them.org_id, 'audit.view')
        or public.shares_project_with(them.id)
      )
  ));

-- ── Estructura de permisos: la configura la plataforma ───────
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.role_id = 'superadmin'
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

drop policy "branch_permissions: write if top level" on public.branch_permissions;
create policy "branch_permissions: write if platform" on public.branch_permissions for all
  using (exists (select 1 from public.branches b where b.id = branch_id and public.has_permission(b.org_id, 'platform.manage')))
  with check (exists (select 1 from public.branches b where b.id = branch_id and public.has_permission(b.org_id, 'platform.manage')));

drop policy "department_permissions: write if top level" on public.department_permissions;
create policy "department_permissions: write if platform" on public.department_permissions for all
  using (exists (select 1 from public.departments d where d.id = department_id and public.has_permission(d.org_id, 'platform.manage')))
  with check (exists (select 1 from public.departments d where d.id = department_id and public.has_permission(d.org_id, 'platform.manage')));

-- La plataforma también crea y edita ramas (además de quien gestiona departamentos)
drop policy "branches: write with departments.manage" on public.branches;
create policy "branches: write with departments.manage or platform" on public.branches for all
  using (public.has_permission(org_id, 'departments.manage') or public.has_permission(org_id, 'platform.manage'))
  with check (public.has_permission(org_id, 'departments.manage') or public.has_permission(org_id, 'platform.manage'));

drop function if exists public.is_top_level(uuid);

create trigger trg_audit_branch_permissions after insert or delete on public.branch_permissions
  for each row execute function audit.log_change();
create trigger trg_audit_department_permissions after insert or delete on public.department_permissions
  for each row execute function audit.log_change();

-- ------------------------------------------------------------
-- Registro de errores
-- ------------------------------------------------------------
create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('server', 'action', 'client', 'data')),
  message text not null,
  digest text,
  stack text,
  path text,
  context jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index error_logs_created_idx on public.error_logs (created_at desc);
create index error_logs_open_idx on public.error_logs (created_at desc) where resolved_at is null;

alter table public.error_logs enable row level security;

create policy "error_logs: select platform" on public.error_logs for select using (public.is_platform_admin());
create policy "error_logs: resolve platform" on public.error_logs for update
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "error_logs: delete platform" on public.error_logs for delete using (public.is_platform_admin());
-- Sin política de insert: solo por log_error

-- Al resolverlo solo cambia si está resuelto; quién y cuándo lo pone la base
create or replace function public.guard_error_log_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'resolved_at' - 'resolved_by') is distinct from (to_jsonb(old) - 'resolved_at' - 'resolved_by') then
    raise exception 'only the resolution of an error can be changed';
  end if;
  if new.resolved_at is not null and old.resolved_at is null then
    new.resolved_at := now();
    new.resolved_by := auth.uid();
  elsif new.resolved_at is null then
    new.resolved_by := null;
  end if;
  return new;
end;
$$;

create trigger trg_error_logs_guard
  before update on public.error_logs
  for each row execute function public.guard_error_log_update();

-- Reportar un error. Lo llaman el servidor, las acciones y el navegador (también sin sesión,
-- p. ej. en la web pública). Se recortan los textos y se frena el exceso: un bug que se
-- repite en bucle no llena la base.
create or replace function public.log_error(
  p_source text,
  p_message text,
  p_digest text default null,
  p_stack text default null,
  p_path text default null,
  p_context jsonb default '{}'::jsonb,
  p_org_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := case when p_org_id is not null and public.is_org_member(p_org_id) then p_org_id end;
begin
  if p_source not in ('server', 'action', 'client', 'data') or coalesce(trim(p_message), '') = '' then
    return;
  end if;
  -- Máximo 30 por minuto por persona (o por las visitas anónimas en conjunto) y 300 en total
  if (select count(*) from public.error_logs
      where created_at > now() - interval '1 minute' and user_id is not distinct from auth.uid()) >= 30
     or (select count(*) from public.error_logs where created_at > now() - interval '1 minute') >= 300 then
    return;
  end if;
  insert into public.error_logs (source, message, digest, stack, path, context, user_id, org_id)
  values (
    p_source,
    left(p_message, 1000),
    left(p_digest, 100),
    left(p_stack, 8000),
    left(p_path, 500),
    case when pg_column_size(p_context) <= 8000 then coalesce(p_context, '{}'::jsonb) else '{"truncado": true}'::jsonb end,
    auth.uid(),
    v_org
  );
end;
$$;

revoke execute on function public.log_error(text, text, text, text, text, jsonb, uuid) from public;
grant execute on function public.log_error(text, text, text, text, text, jsonb, uuid) to anon, authenticated;
