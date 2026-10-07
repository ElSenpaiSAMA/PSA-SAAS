-- ============================================================
-- Datos demo para desarrollo local (`npx supabase db reset`).
-- Todos los usuarios tienen la contraseña: Demo1234!
-- ============================================================

create or replace function pg_temp.demo_user(p_id uuid, p_email text, p_name text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt('Demo1234!', gen_salt('bf')), now(),
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

select pg_temp.demo_user('11111111-1111-1111-1111-111111111111', 'laura@demo.com', 'Laura Méndez');
select pg_temp.demo_user('22222222-2222-2222-2222-222222222222', 'carlos@demo.com', 'Carlos Ruiz');
select pg_temp.demo_user('33333333-3333-3333-3333-333333333333', 'ana@demo.com', 'Ana Torres');
select pg_temp.demo_user('44444444-4444-4444-4444-444444444444', 'diego@demo.com', 'Diego Fernández');
select pg_temp.demo_user('55555555-5555-5555-5555-555555555555', 'sofia@demo.com', 'Sofía Navarro');
-- Un usuario por cada puesto de la estructura (ver 0022_org_structure.sql)
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

-- La empresa: Diplonautic. La plataforma es multi-tenant por dentro (RLS por
-- organización): la segunda organización no tiene miembros de demo y solo existe
-- para que los tests comprueben el aislamiento entre empresas.
insert into public.organizations (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Diplonautic'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Otra empresa (pruebas de aislamiento)');

-- Ramas de Diplonautic. Cada una gestiona a nivel empresa lo de su función
-- (branch_permissions): lo recibe quien la dirige.
insert into public.branches (id, org_id, name, color) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Técnica', 'blue'),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Comercial', 'green'),
  ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Administración y RRHH', 'violet');

insert into public.branch_permissions (branch_id, permission_key)
select 'dddddddd-0000-0000-0000-000000000001', k from unnest(array['tasks.manage_all']) k
union all
select 'dddddddd-0000-0000-0000-000000000002', k from unnest(array['projects.manage', 'tasks.manage_all', 'billing.manage', 'contact.manage']) k
union all
select 'dddddddd-0000-0000-0000-000000000003', k from unnest(array[
  'employees.manage', 'people.sensitive', 'departments.manage', 'holidays.manage', 'automations.manage',
  'billing.manage', 'projects.manage', 'tasks.manage_all', 'contact.manage', 'forum.moderate'
]) k;

-- Diplonautic:
--   Laura (CEO) → Jorge (dir. técnico) → Carlos (resp. Taller) → Ana, Diego, Toni (encargado) → Lucía (aprendiz)
--              → Raúl (dir. comercial) → Nuria (resp. Oficina técnica) → Pol
--              → Sofía (dir. Administración y RRHH, resp. Administración) → Irene (resp. RRHH), Iván, Gestoría (externa)
--   Superadmin (dev@demo.com): la plataforma, oculto en la empresa
insert into public.memberships (id, org_id, user_id, role_id, manager_id, position, weekly_hours, directs_branch_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner',      null,                                   'CEO',                      40, null),
  ('bbbbbbbb-0000-0000-0000-000000000101', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'superadmin', null,                                   'Desarrollo (plataforma)',  40, null),
  ('bbbbbbbb-0000-0000-0000-000000000102', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'director',   'bbbbbbbb-0000-0000-0000-000000000001', 'Director técnico',         40, 'dddddddd-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000103', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'director',   'bbbbbbbb-0000-0000-0000-000000000001', 'Director comercial',       40, 'dddddddd-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'director',   'bbbbbbbb-0000-0000-0000-000000000001', 'Directora de administración y RRHH', 40, 'dddddddd-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'manager',     'bbbbbbbb-0000-0000-0000-000000000102', 'Jefe de taller',           40, null),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'employee',    'bbbbbbbb-0000-0000-0000-000000000002', 'Técnica de climatización', 40, null),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'employee',    'bbbbbbbb-0000-0000-0000-000000000002', 'Técnico electricista',     32, null),
  ('bbbbbbbb-0000-0000-0000-000000000104', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'manager',     'bbbbbbbb-0000-0000-0000-000000000103', 'Responsable de oficina técnica', 40, null),
  ('bbbbbbbb-0000-0000-0000-000000000105', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'manager',     'bbbbbbbb-0000-0000-0000-000000000005', 'Responsable de RRHH',      40, null),
  ('bbbbbbbb-0000-0000-0000-000000000106', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'coordinator', 'bbbbbbbb-0000-0000-0000-000000000002', 'Encargado de varadero',    40, null),
  ('bbbbbbbb-0000-0000-0000-000000000107', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'employee',    'bbbbbbbb-0000-0000-0000-000000000104', 'Técnico comercial',        40, null),
  ('bbbbbbbb-0000-0000-0000-000000000108', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 'intern',      'bbbbbbbb-0000-0000-0000-000000000106', 'Aprendiz de taller',       30, null),
  ('bbbbbbbb-0000-0000-0000-000000000109', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'employee',    'bbbbbbbb-0000-0000-0000-000000000005', 'Administrativo',           40, null),
  ('bbbbbbbb-0000-0000-0000-000000000110', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'external',    'bbbbbbbb-0000-0000-0000-000000000005', 'Gestoría externa',         20, null);


-- Departamentos de Diplonautic: el responsable pasa a ser el manager de sus miembros
insert into public.departments (id, org_id, name, head_id, branch_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dirección',       'bbbbbbbb-0000-0000-0000-000000000001', null),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Taller',          'bbbbbbbb-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Administración',  'bbbbbbbb-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000003'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Oficina técnica', 'bbbbbbbb-0000-0000-0000-000000000104', 'dddddddd-0000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'RRHH',            'bbbbbbbb-0000-0000-0000-000000000105', 'dddddddd-0000-0000-0000-000000000003');

-- Lo que gestiona cada responsable a nivel empresa, por la función de su departamento
insert into public.department_permissions (department_id, permission_key)
select 'eeeeeeee-0000-0000-0000-000000000004', k from unnest(array['projects.manage', 'contact.manage']) k
union all
select 'eeeeeeee-0000-0000-0000-000000000005', k from unnest(array['employees.manage', 'people.sensitive', 'holidays.manage']) k
union all
select 'eeeeeeee-0000-0000-0000-000000000003', k from unnest(array['billing.manage']) k;

update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000002'
where id in ('bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004',
             'bbbbbbbb-0000-0000-0000-000000000106', 'bbbbbbbb-0000-0000-0000-000000000108');
update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000004'
where id = 'bbbbbbbb-0000-0000-0000-000000000107';
update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000003'
where id in ('bbbbbbbb-0000-0000-0000-000000000109', 'bbbbbbbb-0000-0000-0000-000000000110');
-- Al entrar al departamento el manager pasa a ser el responsable: la aprendiz reporta
-- al encargado, y la responsable de RRHH a la directora de la rama
update public.memberships set manager_id = 'bbbbbbbb-0000-0000-0000-000000000106' where id = 'bbbbbbbb-0000-0000-0000-000000000108';
update public.memberships set manager_id = 'bbbbbbbb-0000-0000-0000-000000000005' where id = 'bbbbbbbb-0000-0000-0000-000000000105';

-- Proyectos = trabajos en barcos de clientes. Ana ve solo el Princess (climatización),
-- Diego solo el Lagoon (eléctrico, y es su responsable), Carlos ambos por ser responsable
-- del Taller, Jorge por dirigir la rama Técnica, y Laura, Sofía, Raúl y Nuria todo por su función.
insert into public.projects (id, org_id, name, client_name, budgeted_hours, hourly_rate, department_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Climatización Princess V58', 'Náutica Costa Brava',  320, 65,   'eeeeeeee-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Refit eléctrico Lagoon 46',  'Charter Mediterráneo', 200, 70,   'eeeeeeee-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Formación interna',          null,                   60,  null, 'eeeeeeee-0000-0000-0000-000000000003');

-- Órdenes de trabajo: el mes anterior cerrado y facturado, el actual en curso
create or replace function pg_temp.m0() returns date language sql as $$ select date_trunc('month', current_date)::date $$;
create or replace function pg_temp.m_end() returns date language sql as $$ select (date_trunc('month', current_date) + interval '1 month - 1 day')::date $$;
create or replace function pg_temp.prev0() returns date language sql as $$ select (date_trunc('month', current_date) - interval '1 month')::date $$;
create or replace function pg_temp.month_name(p date) returns text language sql as $$
  select (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])[extract(month from p)::int]
         || ' ' || extract(year from p)::int
$$;

insert into public.work_orders (id, project_id, title, period_start, period_end, budgeted_hours, status, billing_status, invoiced_at) values
  ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Princess V58 · ' || pg_temp.month_name(pg_temp.prev0()), pg_temp.prev0(), pg_temp.m0() - 1, 60, 'closed', 'invoiced', now() - interval '3 days'),
  ('ffffffff-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'Princess V58 · ' || pg_temp.month_name(pg_temp.m0()),    pg_temp.m0(), pg_temp.m_end(), 90, 'in_progress', 'unbilled', null),
  ('ffffffff-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000002', 'Lagoon 46 · '    || pg_temp.month_name(pg_temp.m0()),    pg_temp.m0(), pg_temp.m_end(), 70, 'in_progress', 'unbilled', null),
  ('ffffffff-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003', 'Formación · '    || pg_temp.month_name(pg_temp.m0()),    pg_temp.m0(), pg_temp.m_end(), 20, 'approved',    'unbilled', null);

-- Cada asignado queda como miembro del proyecto (trigger tasks_sync_org)
insert into public.tasks (id, project_id, work_order_id, title, assigned_to, estimated_hours, status, start_date, due_date) values
  -- Mes anterior (cerrado y facturado): base para "copiar al mes siguiente"
  ('dddddddd-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Revisión del aire acondicionado', 'bbbbbbbb-0000-0000-0000-000000000003', 30, 'done',        pg_temp.prev0() + 1,  pg_temp.prev0() + 20),
  ('dddddddd-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Asistencia en el amarre',         'bbbbbbbb-0000-0000-0000-000000000003', 20, 'done',        pg_temp.prev0(),      pg_temp.m0() - 1),
  ('dddddddd-0000-0000-0000-000000000010', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Informe técnico mensual',         'bbbbbbbb-0000-0000-0000-000000000002', 4,  'done',        pg_temp.m0() - 3,     pg_temp.m0() - 1),
  -- Mes actual
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'Desmontaje de unidades viejas',   'bbbbbbbb-0000-0000-0000-000000000003', 24, 'done',        pg_temp.m0(),         pg_temp.m0() + 6),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'Instalación de unidades de 16.000 BTU', 'bbbbbbbb-0000-0000-0000-000000000003', 40, 'in_progress', pg_temp.m0() + 5,     pg_temp.m0() + 19),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'Prueba de estanqueidad y carga de gas', 'bbbbbbbb-0000-0000-0000-000000000003', 16, 'todo',        pg_temp.m0() + 18,    pg_temp.m0() + 25),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'Instalación de baterías de litio', 'bbbbbbbb-0000-0000-0000-000000000004', 30, 'in_progress', pg_temp.m0(),         pg_temp.m0() + 13),
  ('dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'Cableado del cuadro eléctrico',   'bbbbbbbb-0000-0000-0000-000000000004', 20, 'todo',        pg_temp.m0() + 12,    pg_temp.m0() + 24),
  ('dddddddd-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'Diagnóstico del sistema eléctrico', 'bbbbbbbb-0000-0000-0000-000000000002', 8,  'done',        pg_temp.m0(),         pg_temp.m0() + 3),
  ('dddddddd-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000004', 'Curso de prevención de riesgos',  'bbbbbbbb-0000-0000-0000-000000000005', 10, 'in_progress', pg_temp.m0() + 2,     pg_temp.m0() + 16);

-- Horas del mes anterior (ya facturadas)
insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
select t.assigned_to, 'task', t.id, d + time '10:00', d + time '10:00' + (t.hours * interval '1 hour')
from generate_series(pg_temp.prev0(), pg_temp.m0() - 1, interval '1 day') d
cross join (values
  ('dddddddd-0000-0000-0000-000000000008'::uuid, 'bbbbbbbb-0000-0000-0000-000000000003'::uuid, 1.5),
  ('dddddddd-0000-0000-0000-000000000009'::uuid, 'bbbbbbbb-0000-0000-0000-000000000003'::uuid, 1)
) as t(id, assigned_to, hours)
where extract(isodow from d) < 6;

-- Fichajes y horas de las últimas dos semanas (días hábiles)
insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
select
  m.id,
  'clock',
  null,
  d + time '09:00' + (random() * interval '20 minutes'),
  d + time '17:30' + (random() * interval '40 minutes')
from generate_series(current_date - 14, current_date - 1, interval '1 day') d
cross join (values
  ('bbbbbbbb-0000-0000-0000-000000000002'::uuid),
  ('bbbbbbbb-0000-0000-0000-000000000003'::uuid),
  ('bbbbbbbb-0000-0000-0000-000000000004'::uuid),
  ('bbbbbbbb-0000-0000-0000-000000000005'::uuid)
) as m(id)
where extract(isodow from d) < 6;

insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
select
  t.assigned_to,
  'task',
  t.id,
  d + time '10:00',
  d + time '10:00' + (t.hours * interval '1 hour')
from generate_series(current_date - 14, current_date - 1, interval '1 day') d
cross join (values
  ('dddddddd-0000-0000-0000-000000000002'::uuid, 'bbbbbbbb-0000-0000-0000-000000000003'::uuid, 4.5),
  ('dddddddd-0000-0000-0000-000000000004'::uuid, 'bbbbbbbb-0000-0000-0000-000000000004'::uuid, 5),
  ('dddddddd-0000-0000-0000-000000000007'::uuid, 'bbbbbbbb-0000-0000-0000-000000000005'::uuid, 2)
) as t(id, assigned_to, hours)
where extract(isodow from d) < 6;

-- Vacaciones: una aprobada, dos pendientes para que el manager tenga qué aprobar
insert into public.vacation_requests (membership_id, start_date, end_date, status, reason, decided_by, decided_at) values
  ('bbbbbbbb-0000-0000-0000-000000000003', date_trunc('year', current_date)::date + 60, date_trunc('year', current_date)::date + 64, 'approved', 'Viaje familiar', 'bbbbbbbb-0000-0000-0000-000000000002', now() - interval '200 days'),
  ('bbbbbbbb-0000-0000-0000-000000000003', current_date + 21, current_date + 25, 'pending', 'Escapada a la montaña', null, null),
  ('bbbbbbbb-0000-0000-0000-000000000004', current_date + 35, current_date + 39, 'pending', 'Boda de un amigo', null, null);

-- Invitación pendiente para probar el alta: Marc puede registrarse en /signup
-- y entra directo a Diplonautic como técnico (sin invitación, el registro se rechaza)
insert into public.invitations (org_id, email, role_id, manager_id, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'marc.vidal@demo.com', 'employee', 'bbbbbbbb-0000-0000-0000-000000000002', 'Técnico electricista');

-- Festivos nacionales (año actual y siguiente) para Diplonautic
insert into public.holidays (org_id, date, name)
select 'aaaaaaaa-0000-0000-0000-000000000001', make_date(y, h.m, h.d), h.name
from generate_series(extract(year from current_date)::int, extract(year from current_date)::int + 1) y
cross join (values
  (1, 1, 'Año Nuevo'), (1, 6, 'Reyes'), (5, 1, 'Día del Trabajador'), (8, 15, 'Asunción'),
  (10, 12, 'Fiesta Nacional'), (11, 1, 'Todos los Santos'), (12, 6, 'Día de la Constitución'),
  (12, 8, 'Inmaculada Concepción'), (12, 25, 'Navidad')
) as h(m, d, name)
on conflict do nothing;

-- Fichas de empleado (datos ficticios) con historial de versiones:
-- alta, subida de sueldo y cambio de contrato con distintas fechas de vigencia
insert into public.employee_records
  (org_id, membership_id, effective_from, national_id, birth_date, phone, personal_email, address, emergency_contact,
   hire_date, contract_type, salary_annual, iban, notes)
values
  -- Laura (CEO)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '2021-01-11', '12345678Z', '1985-04-02', '+34 600 111 222', 'laura.mendez@correo.test', 'Calle Mayor 1, Madrid', 'Pablo Méndez · +34 600 999 000',
   '2021-01-11', 'indefinido', 85000, 'ES91 2100 0418 4502 0005 1332', null),
  -- Carlos: alta y ascenso a lead con subida
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '2022-03-01', '23456789D', '1988-09-14', '+34 600 222 333', 'carlos.ruiz@correo.test', 'Av. Diagonal 200, Barcelona', 'Marta Ruiz · +34 600 888 111',
   '2022-03-01', 'indefinido', 52000, 'ES79 2100 0813 6101 2345 6789', 'Alta como técnico electricista'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', (date_trunc('year', current_date) + interval '2 months')::date, '23456789D', '1988-09-14', '+34 600 222 333', 'carlos.ruiz@correo.test', 'Av. Diagonal 200, Barcelona', 'Marta Ruiz · +34 600 888 111',
   '2022-03-01', 'indefinido', 61000, 'ES79 2100 0813 6101 2345 6789', 'Ascenso a jefe de taller'),
  -- Ana: entra en prácticas, pasa a indefinida y se muda el mes pasado
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', '2024-02-05', '34567890V', '1999-01-20', '+34 600 333 444', 'ana.torres@correo.test', 'Calle Sol 5, Valencia', 'Lucía Torres · +34 600 777 222',
   '2024-02-05', 'practicas', 18000, 'ES12 0049 1500 0512 3456 7892', 'Prácticas 6 meses'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', '2024-08-05', '34567890V', '1999-01-20', '+34 600 333 444', 'ana.torres@correo.test', 'Calle Sol 5, Valencia', 'Lucía Torres · +34 600 777 222',
   '2024-02-05', 'indefinido', 34000, 'ES12 0049 1500 0512 3456 7892', 'Pasa a indefinida'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', (date_trunc('month', current_date) - interval '1 month' + interval '14 days')::date, '34567890V', '1999-01-20', '+34 611 333 444', 'ana.torres@correo.test', 'Calle Luna 12, Madrid', 'Lucía Torres · +34 600 777 222',
   '2024-02-05', 'indefinido', 34000, 'ES12 0049 1500 0512 3456 7892', 'Cambio de domicilio y teléfono'),
  -- Diego: temporal, 32 h
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', '2025-06-02', '45678901G', '1995-06-30', '+34 600 444 555', 'diego.fernandez@correo.test', 'Calle Río 8, Sevilla', 'Elena Fernández · +34 600 666 333',
   '2025-06-02', 'temporal', 36000, 'ES66 0182 0400 1234 5678 9012', 'Jornada de 32 h'),
  -- Sofía (Administración y RRHH)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005', '2021-09-13', '56789012B', '1990-11-08', '+34 600 555 666', 'sofia.lopez@correo.test', 'Calle Prado 3, Madrid', 'Andrés López · +34 600 555 777',
   '2021-09-13', 'indefinido', 48000, 'ES38 0081 0200 0100 0123 4567', null);

-- Foro interno: dudas, avisos e incidencias técnicas del taller
insert into public.forum_threads (id, author_id, category, title, body, pinned, locked, resolved, created_at) values
  ('99999999-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005', 'notice',
   'Nuevo protocolo de seguridad en el varadero',
   E'A partir del lunes, para trabajar bajo un barco en seco es obligatorio:\n\n- Calzos y puntales revisados por el jefe de varadero antes de empezar.\n- Casco y botas de seguridad en toda la zona de grúa.\n- Avisar por el canal de taller antes de mover la grúa travel-lift.\n\nCualquier duda, respondé en este hilo.',
   true, false, false, now() - interval '9 days'),
  ('99999999-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', 'incident',
   'Plotter Garmin GPSMAP 8612 del Lagoon 42 se reinicia solo',
   E'El plotter del Lagoon 42 (cliente Charter Mediterráneo) se reinicia cada 10-15 minutos con los motores en marcha. Con motores parados aguanta bien.\n\nYa revisé la tensión en bornes: 12,8 V parado y 14,1 V con el alternador cargando. ¿A alguien le pasó algo parecido?',
   false, false, true, now() - interval '6 days'),
  ('99999999-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'question',
   '¿Qué sellador usamos para pasacascos bajo la línea de flotación?',
   E'Tengo que cambiar dos pasacascos de bronce en un velero de 38 pies. ¿Seguimos usando Sikaflex 291i o hay algo mejor para debajo de la flotación?',
   false, false, false, now() - interval '4 days'),
  ('99999999-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'incident',
   'Alternador del Volvo Penta D2-40 no carga en ralentí',
   E'En el refit del Bavaria 46 el alternador no carga por debajo de 1.200 rpm. La correa está bien tensada. Sospecho del regulador. ¿Alguien tiene un regulador de repuesto en el almacén?',
   false, false, false, now() - interval '2 days'),
  ('99999999-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 'notice',
   'Pedidos de repuestos urgentes: nuevo procedimiento',
   E'Los pedidos urgentes a proveedor (entrega en 24 h) los aprueba el jefe de taller. Cargá el pedido en el parte de la orden de trabajo y avisá por este canal. Cierro el hilo para que quede como referencia.',
   false, true, false, now() - interval '12 days');

insert into public.forum_posts (thread_id, author_id, body, created_at) values
  ('99999999-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003',
   '¿Los puntales nuevos ya están en el varadero o seguimos con los de siempre?', now() - interval '8 days'),
  ('99999999-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005',
   'Llegaron ayer: están junto a la grúa, etiquetados en amarillo.', now() - interval '8 days' + interval '3 hours'),
  ('99999999-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   'Me pasó en un Fountaine Pajot: era el ruido del alternador entrando por la alimentación. Probá con un filtro de ruido en la línea de 12 V del plotter.', now() - interval '6 days' + interval '2 hours'),
  ('99999999-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004',
   'Era eso. Con el filtro instalado lleva 3 horas sin reiniciarse. Lo marco como resuelto, gracias.', now() - interval '5 days'),
  ('99999999-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002',
   'Para bajo flotación usamos Sikaflex 291i, sí. Limpiá bien con Sika Aktivator y dejá curar 24 h antes de botar.', now() - interval '4 days' + interval '1 hour'),
  ('99999999-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004',
   'Queda uno en la estantería B3, caja de Volvo. Te lo dejo en el banco del taller.', now() - interval '1 day');

-- Mensajes del formulario de contacto de la web (se gestionan en Intranet → Mensajes web)
insert into public.contact_messages (id, org_id, name, email, phone, boat_type, boat_model, service, message, status, handled_by, handled_at, created_at) values
  ('88888888-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Marta Soler', 'marta.soler@example.com', '+34 612 345 678', 'Velero', 'Beneteau Oceanis 41',
   'Aire acondicionado',
   E'Hola, el aire acondicionado del camarote de proa enfría muy poco y hace ruido al arrancar. El barco está en Port Olímpic. ¿Podrían revisarlo esta semana?',
   'new', null, null, now() - interval '3 hours'),
  ('88888888-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Jordi Puig', 'jordi.puig@example.com', null, 'Lancha / motor', 'Sunseeker Portofino 40',
   'Generadores',
   E'El generador Onan se para a los diez minutos con una alarma de temperatura. Querría un presupuesto para la revisión completa antes del verano.',
   'new', null, null, now() - interval '1 day'),
  ('88888888-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Elena Ruiz', 'elena.ruiz@example.com', '+34 699 112 233', 'Catamarán', 'Lagoon 42',
   'Potabilizadoras',
   E'Queremos instalar una potabilizadora de unos 60 l/h para navegar por Baleares en julio. ¿Qué modelos recomiendan y cuánto tiempo lleva la instalación?',
   'in_progress', 'bbbbbbbb-0000-0000-0000-000000000005', now() - interval '2 days', now() - interval '3 days'),
  ('88888888-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Pau Ferrer', 'pau.ferrer@example.com', null, 'Semirrígida', null,
   'ElectroMotor: arranque, alternador o dinamo',
   E'El motor de arranque hace clic pero no gira. Ya cambié la batería. ¿Reparan motores de arranque fuera del barco si se los llevo al taller?',
   'closed', 'bbbbbbbb-0000-0000-0000-000000000001', now() - interval '6 days', now() - interval '9 days');

-- Rol en cada proyecto (estructura del trabajo): Diego lleva el Lagoon; Pol sigue el
-- Princess como observador para el cliente; Lucía (aprendiz) ayuda en el Princess
insert into public.project_members (project_id, membership_id, role) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', 'lead'),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000107', 'observer'),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000108', 'member')
on conflict (project_id, membership_id) do update set role = excluded.role;
