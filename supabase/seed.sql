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

-- Dos organizaciones: Laura y Carlos pertenecen a ambas (prueba el selector de org)
insert into public.organizations (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Nébula Studio'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Orbital Labs');

-- Nébula Studio: Laura (owner) → Carlos (manager) → Ana, Diego ; Sofía (admin)
insert into public.memberships (id, org_id, user_id, role_id, manager_id, position, weekly_hours) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner',    null,                                   'CEO',                40),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'admin',    'bbbbbbbb-0000-0000-0000-000000000001', 'People Ops',         40),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'manager',  'bbbbbbbb-0000-0000-0000-000000000001', 'Engineering Lead',   40),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'employee', 'bbbbbbbb-0000-0000-0000-000000000002', 'Frontend Engineer',  40),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'employee', 'bbbbbbbb-0000-0000-0000-000000000002', 'Backend Engineer',   32);

-- Orbital Labs: Carlos (owner), Laura (employee) — mismo usuario, distinto rol según la empresa
insert into public.memberships (id, org_id, user_id, role_id, manager_id, position) values
  ('bbbbbbbb-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner',    null,                                   'Founder'),
  ('bbbbbbbb-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'employee', 'bbbbbbbb-0000-0000-0000-000000000011', 'Advisor');

-- Departamentos de Nébula Studio: el responsable pasa a ser el manager de sus miembros
insert into public.departments (id, org_id, name, head_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Dirección',  'bbbbbbbb-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ingeniería', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'People',     'bbbbbbbb-0000-0000-0000-000000000005');

update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000002'
where id in ('bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004');

-- Ana ve solo "Portal clientes", Diego solo "API de pagos" (según sus tareas),
-- Carlos ambos por ser responsable de Ingeniería, Sofía y Laura todo por ser admin/owner.
insert into public.projects (id, org_id, name, client_name, budgeted_hours, hourly_rate, department_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rediseño portal clientes', 'Acme Corp', 320, 85,   'eeeeeeee-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'API de pagos v2',           'Fintrack',  200, 95,   'eeeeeeee-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Onboarding interno',        null,        60,  null, 'eeeeeeee-0000-0000-0000-000000000003');

-- Órdenes de trabajo: el mes anterior cerrado y facturado, el actual en curso
create or replace function pg_temp.m0() returns date language sql as $$ select date_trunc('month', current_date)::date $$;
create or replace function pg_temp.m_end() returns date language sql as $$ select (date_trunc('month', current_date) + interval '1 month - 1 day')::date $$;
create or replace function pg_temp.prev0() returns date language sql as $$ select (date_trunc('month', current_date) - interval '1 month')::date $$;
create or replace function pg_temp.month_name(p date) returns text language sql as $$
  select (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])[extract(month from p)::int]
         || ' ' || extract(year from p)::int
$$;

insert into public.work_orders (id, project_id, title, period_start, period_end, budgeted_hours, status, billing_status, invoiced_at) values
  ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Portal clientes · ' || pg_temp.month_name(pg_temp.prev0()), pg_temp.prev0(), pg_temp.m0() - 1, 60, 'closed', 'invoiced', now() - interval '3 days'),
  ('ffffffff-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'Portal clientes · ' || pg_temp.month_name(pg_temp.m0()),    pg_temp.m0(), pg_temp.m_end(), 90, 'in_progress', 'unbilled', null),
  ('ffffffff-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000002', 'API de pagos · '    || pg_temp.month_name(pg_temp.m0()),    pg_temp.m0(), pg_temp.m_end(), 70, 'in_progress', 'unbilled', null),
  ('ffffffff-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003', 'Onboarding · '      || pg_temp.month_name(pg_temp.m0()),    pg_temp.m0(), pg_temp.m_end(), 20, 'approved',    'unbilled', null);

-- Cada asignado queda como miembro del proyecto (trigger tasks_sync_org)
insert into public.tasks (id, project_id, work_order_id, title, assigned_to, estimated_hours, status, start_date, due_date) values
  -- Mes anterior (cerrado y facturado): base para "copiar al mes siguiente"
  ('dddddddd-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Mantenimiento evolutivo',    'bbbbbbbb-0000-0000-0000-000000000003', 30, 'done',        pg_temp.prev0() + 1,  pg_temp.prev0() + 20),
  ('dddddddd-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Soporte a usuarios',         'bbbbbbbb-0000-0000-0000-000000000003', 20, 'done',        pg_temp.prev0(),      pg_temp.m0() - 1),
  ('dddddddd-0000-0000-0000-000000000010', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Informe mensual',            'bbbbbbbb-0000-0000-0000-000000000002', 4,  'done',        pg_temp.m0() - 3,     pg_temp.m0() - 1),
  -- Mes actual
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'Sistema de diseño y tokens', 'bbbbbbbb-0000-0000-0000-000000000003', 24, 'done',        pg_temp.m0(),         pg_temp.m0() + 6),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'Dashboard de cliente',       'bbbbbbbb-0000-0000-0000-000000000003', 40, 'in_progress', pg_temp.m0() + 5,     pg_temp.m0() + 19),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'Accesibilidad AA',           'bbbbbbbb-0000-0000-0000-000000000003', 16, 'todo',        pg_temp.m0() + 18,    pg_temp.m0() + 25),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'Webhooks idempotentes',      'bbbbbbbb-0000-0000-0000-000000000004', 30, 'in_progress', pg_temp.m0(),         pg_temp.m0() + 13),
  ('dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'Conciliación nocturna',      'bbbbbbbb-0000-0000-0000-000000000004', 20, 'todo',        pg_temp.m0() + 12,    pg_temp.m0() + 24),
  ('dddddddd-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'Revisión de arquitectura',   'bbbbbbbb-0000-0000-0000-000000000002', 8,  'done',        pg_temp.m0(),         pg_temp.m0() + 3),
  ('dddddddd-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000004', 'Guía de bienvenida',         'bbbbbbbb-0000-0000-0000-000000000005', 10, 'in_progress', pg_temp.m0() + 2,     pg_temp.m0() + 16);

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

-- Invitación pendiente para probar el alta de empleados
insert into public.invitations (org_id, email, role_id, manager_id, position) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ana@demo.com', 'employee', 'bbbbbbbb-0000-0000-0000-000000000011', 'Designer');

-- Festivos nacionales (año actual y siguiente) para Nébula Studio
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
   '2022-03-01', 'indefinido', 52000, 'ES79 2100 0813 6101 2345 6789', 'Alta como Senior Engineer'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', (date_trunc('year', current_date) + interval '2 months')::date, '23456789D', '1988-09-14', '+34 600 222 333', 'carlos.ruiz@correo.test', 'Av. Diagonal 200, Barcelona', 'Marta Ruiz · +34 600 888 111',
   '2022-03-01', 'indefinido', 61000, 'ES79 2100 0813 6101 2345 6789', 'Ascenso a Engineering Lead'),
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
  -- Sofía (People Ops)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005', '2021-09-13', '56789012B', '1990-11-08', '+34 600 555 666', 'sofia.lopez@correo.test', 'Calle Prado 3, Madrid', 'Andrés López · +34 600 555 777',
   '2021-09-13', 'indefinido', 48000, 'ES38 0081 0200 0100 0123 4567', null);
