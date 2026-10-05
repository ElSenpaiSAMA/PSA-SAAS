-- Tests de seguridad (pgTAP) sobre el seed demo. Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Simula una request autenticada como el usuario dado
create or replace function pg_temp.login_as(p_user uuid, p_email text)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', p_email, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function pg_temp.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Aislamiento multi-tenant ─────────────────────────────────
-- Diego solo pertenece a Nébula Studio
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');

select is(
  (select count(*)::int from public.organizations),
  1,
  'un empleado solo ve las organizaciones a las que pertenece'
);

select is(
  (select count(*)::int from public.projects where org_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'no se ven proyectos de otra organización'
);

select is(
  (select count(*)::int from public.time_entries
   where membership_id <> 'bbbbbbbb-0000-0000-0000-000000000004'),
  0,
  'un empleado sin reportes solo ve sus propios fichajes'
);

select is(
  (select count(*)::int from public.vacation_requests
   where membership_id <> 'bbbbbbbb-0000-0000-0000-000000000004'),
  0,
  'un empleado solo ve sus propias vacaciones'
);

-- ── Horas agregadas por tarea ────────────────────────────────
select ok(
  (select count(*) from public.task_logged_minutes('aaaaaaaa-0000-0000-0000-000000000001')) > 0,
  'un miembro ve las horas agregadas de todas las tareas de su org'
);

select is(
  (select count(*)::int from public.task_logged_minutes('aaaaaaaa-0000-0000-0000-000000000002')),
  0,
  'no se obtienen horas de tareas de una org ajena'
);

-- ── Fichaje ──────────────────────────────────────────────────
select lives_ok(
  $$ insert into public.time_entries (membership_id, entry_type, started_at)
     values ('bbbbbbbb-0000-0000-0000-000000000004', 'clock', now() - interval '3 days') $$,
  'un empleado puede fichar entrada'
);

select ok(
  (select started_at > now() - interval '1 minute' from public.time_entries
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and ended_at is null and entry_type = 'clock'),
  'el fichaje se abre siempre con la hora actual, aunque se envíe otra'
);

select throws_ok(
  $$ insert into public.time_entries (membership_id, entry_type)
     values ('bbbbbbbb-0000-0000-0000-000000000004', 'clock') $$,
  '23505',
  null,
  'no se pueden tener dos fichajes abiertos'
);

select throws_ok(
  $$ update public.time_entries set started_at = started_at - interval '2 hours'
     where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and ended_at is null $$,
  'P0001',
  'clock-in time cannot be modified',
  'no se puede reescribir la hora de entrada'
);

select throws_ok(
  $$ insert into public.time_entries (membership_id, entry_type)
     values ('bbbbbbbb-0000-0000-0000-000000000003', 'clock') $$,
  '42501',
  null,
  'no se puede fichar en nombre de otra persona'
);

-- ── Escalada de privilegios ─────────────────────────────────
select is_empty(
  $$ update public.memberships set role_id = 'admin'
     where id = 'bbbbbbbb-0000-0000-0000-000000000004' returning id $$,
  'un empleado no puede cambiarse el rol (RLS filtra el update)'
);

-- Carlos (manager) intenta aprobar vacaciones: las de Diego sí, las propias no
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');

select is(
  (select count(*)::int from public.vacation_requests where status = 'pending'),
  2,
  'el manager ve las solicitudes pendientes de su equipo'
);

select lives_ok(
  $$ update public.vacation_requests set status = 'approved'
     where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and status = 'pending' $$,
  'el manager puede aprobar vacaciones de su reporte'
);

select is(
  (select decided_by from public.vacation_requests
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and status = 'approved'),
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
  'decided_by lo fija el servidor con la membership del aprobador'
);

select pg_temp.logout();
insert into public.vacation_requests (membership_id, start_date, end_date)
values ('bbbbbbbb-0000-0000-0000-000000000002', current_date + 50, current_date + 52);
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');

select throws_ok(
  $$ update public.vacation_requests set status = 'approved'
     where membership_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'pending' $$,
  'P0001',
  'you cannot decide on your own request',
  'nadie puede aprobar sus propias vacaciones'
);

-- Sofía (admin) no puede ascenderse ni gestionar al owner
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');

select throws_ok(
  $$ update public.memberships set role_id = 'owner'
     where id = 'bbbbbbbb-0000-0000-0000-000000000005' $$,
  'P0001',
  'cannot change your own role or status',
  'un admin no puede cambiar su propio rol'
);

select throws_ok(
  $$ update public.memberships set manager_id = 'bbbbbbbb-0000-0000-0000-000000000004'
     where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  'P0001',
  'manager assignment would create a cycle',
  'no se pueden crear ciclos en el organigrama'
);

select * from finish();
rollback;
