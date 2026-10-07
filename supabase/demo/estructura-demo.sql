-- ============================================================
-- Datos de demo de la estructura (0022) para una base que YA tiene el seed anterior.
-- Agrega ramas, departamentos, un usuario por puesto y roles en proyectos.
-- Se puede ejecutar más de una vez: lo que ya existe no se duplica.
-- (En una base nueva no hace falta: `supabase db reset` carga seed.sql completo.)
-- Contraseña de los usuarios nuevos: Demo1234!
-- ============================================================

create or replace function pg_temp.demo_user(p_id uuid, p_email text, p_name text)
returns void
language plpgsql
as $$
begin
  if exists (select 1 from auth.users where id = p_id or lower(email) = lower(p_email)) then
    return;
  end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

select pg_temp.demo_user('10000000-0000-0000-0000-000000000001', 'dev@demo.com', 'Equipo de desarrollo');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000002', 'jorge@demo.com', 'Jorge Martín');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000003', 'raul@demo.com', 'Raúl Ortega');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000004', 'nuria@demo.com', 'Nuria Vidal');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000005', 'irene@demo.com', 'Irene Pastor');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000006', 'toni@demo.com', 'Toni Ferrer');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000007', 'pol@demo.com', 'Pol Serra');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000008', 'lucia@demo.com', 'Lucía Gómez');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000009', 'ivan@demo.com', 'Iván Soler');
select pg_temp.demo_user('10000000-0000-0000-0000-000000000010', 'gestoria@demo.com', 'Gestoría Rius');

-- ── Ramas (la de Administración y RRHH ya la creó la migración para Sofía) ──
insert into public.branches (id, org_id, name, color) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Técnica', 'blue'),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Comercial', 'green'),
  ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Administración y RRHH', 'violet')
on conflict do nothing;

create temp table t_branch as
select
  (select id from public.branches where org_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name = 'Técnica') as tecnica,
  (select id from public.branches where org_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name = 'Comercial') as comercial,
  (select id from public.branches where org_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name = 'Administración y RRHH') as admin;

insert into public.branch_permissions (branch_id, permission_key)
select (select tecnica from t_branch), k from unnest(array['tasks.manage_all']) k
union all
select (select comercial from t_branch), k from unnest(array['projects.manage', 'tasks.manage_all', 'billing.manage', 'contact.manage']) k
union all
select (select admin from t_branch), k from unnest(array[
  'employees.manage', 'people.sensitive', 'departments.manage', 'holidays.manage', 'automations.manage',
  'billing.manage', 'projects.manage', 'tasks.manage_all', 'contact.manage', 'forum.moderate', 'audit.view'
]) k
on conflict do nothing;

-- ── Personas: un usuario por puesto ──────────────────────────
update public.memberships set position = 'CEO' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.memberships
set role_id = 'director', directs_branch_id = (select admin from t_branch), position = 'Directora de administración y RRHH'
where id = 'bbbbbbbb-0000-0000-0000-000000000005';

insert into public.memberships (id, org_id, user_id, role_id, manager_id, position, weekly_hours, directs_branch_id)
select v.id::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', v.user_id::uuid, v.role_id, v.manager_id::uuid, v.position, v.hours, v.branch
from (values
  ('bbbbbbbb-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'superadmin',  null,                                   'Desarrollo (plataforma)',        40, null::uuid),
  ('bbbbbbbb-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000002', 'director',    'bbbbbbbb-0000-0000-0000-000000000001', 'Director técnico',               40, (select tecnica from t_branch)),
  ('bbbbbbbb-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000003', 'director',    'bbbbbbbb-0000-0000-0000-000000000001', 'Director comercial',             40, (select comercial from t_branch)),
  ('bbbbbbbb-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000004', 'manager',     'bbbbbbbb-0000-0000-0000-000000000103', 'Responsable de oficina técnica', 40, null),
  ('bbbbbbbb-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000005', 'manager',     'bbbbbbbb-0000-0000-0000-000000000005', 'Responsable de RRHH',            40, null),
  ('bbbbbbbb-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000006', 'coordinator', 'bbbbbbbb-0000-0000-0000-000000000002', 'Encargado de varadero',          40, null),
  ('bbbbbbbb-0000-0000-0000-000000000107', '10000000-0000-0000-0000-000000000007', 'employee',    'bbbbbbbb-0000-0000-0000-000000000104', 'Técnico comercial',              40, null),
  ('bbbbbbbb-0000-0000-0000-000000000108', '10000000-0000-0000-0000-000000000008', 'intern',      'bbbbbbbb-0000-0000-0000-000000000106', 'Aprendiz de taller',             30, null),
  ('bbbbbbbb-0000-0000-0000-000000000109', '10000000-0000-0000-0000-000000000009', 'employee',    'bbbbbbbb-0000-0000-0000-000000000005', 'Administrativo',                 40, null),
  ('bbbbbbbb-0000-0000-0000-000000000110', '10000000-0000-0000-0000-000000000010', 'external',    'bbbbbbbb-0000-0000-0000-000000000005', 'Gestoría externa',               20, null)
) as v(id, user_id, role_id, manager_id, position, hours, branch)
on conflict do nothing;

-- Carlos (jefe de taller) depende del director técnico
update public.memberships set manager_id = 'bbbbbbbb-0000-0000-0000-000000000102' where id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- ── Departamentos con su rama ────────────────────────────────
update public.departments set branch_id = (select tecnica from t_branch) where id = 'eeeeeeee-0000-0000-0000-000000000002';
update public.departments set branch_id = (select admin from t_branch) where id = 'eeeeeeee-0000-0000-0000-000000000003';
insert into public.departments (id, org_id, name, head_id, branch_id) values
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Oficina técnica', 'bbbbbbbb-0000-0000-0000-000000000104', (select comercial from t_branch)),
  ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'RRHH', 'bbbbbbbb-0000-0000-0000-000000000105', (select admin from t_branch))
on conflict do nothing;

insert into public.department_permissions (department_id, permission_key)
select 'eeeeeeee-0000-0000-0000-000000000004'::uuid, k from unnest(array['projects.manage', 'contact.manage']) k
union all
select 'eeeeeeee-0000-0000-0000-000000000005'::uuid, k from unnest(array['employees.manage', 'people.sensitive', 'holidays.manage', 'audit.view']) k
union all
select 'eeeeeeee-0000-0000-0000-000000000003'::uuid, k from unnest(array['billing.manage']) k
on conflict do nothing;

update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000002'
where id in ('bbbbbbbb-0000-0000-0000-000000000106', 'bbbbbbbb-0000-0000-0000-000000000108') and department_id is null;
update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000004'
where id = 'bbbbbbbb-0000-0000-0000-000000000107' and department_id is null;
update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000003'
where id in ('bbbbbbbb-0000-0000-0000-000000000109', 'bbbbbbbb-0000-0000-0000-000000000110') and department_id is null;
-- La aprendiz reporta al encargado y la responsable de RRHH a la directora de la rama
update public.memberships set manager_id = 'bbbbbbbb-0000-0000-0000-000000000106' where id = 'bbbbbbbb-0000-0000-0000-000000000108';
update public.memberships set manager_id = 'bbbbbbbb-0000-0000-0000-000000000005' where id = 'bbbbbbbb-0000-0000-0000-000000000105';

-- ── Rol en cada proyecto ─────────────────────────────────────
insert into public.project_members (project_id, membership_id, role) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', 'lead'),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000107', 'observer'),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000108', 'member')
on conflict (project_id, membership_id) do update set role = excluded.role;

-- Resumen: quién es quién
select p.email, r.name as nivel, m.position as puesto, coalesce(b.name, d.name) as rama_o_departamento
from public.memberships m
join public.profiles p on p.id = m.user_id
join public.roles r on r.id = m.role_id
left join public.branches b on b.id = m.directs_branch_id
left join public.departments d on d.id = m.department_id
where m.org_id = 'aaaaaaaa-0000-0000-0000-000000000001'
order by r.level desc, p.email;

-- El mantenimiento del Princess es mensual: su OT se renueva sola cada mes (0026)
update public.projects set recurring_work_orders = true where id = 'cccccccc-0000-0000-0000-000000000001';
