-- Ficha de empleado: acceso a datos sensibles e historial (pgTAP) sobre el seed demo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

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

-- ── Empleado: solo su propia ficha, sin editar ───────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');

select ok(
  (select count(*) from public.employee_records where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004') >= 1,
  'un empleado ve su propia ficha'
);
select is(
  (select count(*)::int from public.employee_records where membership_id <> 'bbbbbbbb-0000-0000-0000-000000000004'),
  0,
  'un empleado no ve la ficha de nadie más'
);
select throws_ok(
  $$ insert into public.employee_records (membership_id, effective_from, salary_annual)
     values ('bbbbbbbb-0000-0000-0000-000000000004', current_date, 99999) $$,
  '42501', null,
  'un empleado no puede editar su ficha (ni subirse el sueldo)'
);

-- ── Manager: ve a su equipo en lo laboral, no lo sensible ────
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');

select is(
  (select count(*)::int from public.employee_records where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  0,
  'un manager no ve los datos sensibles de su equipo'
);
select is(
  (select count(*)::int from public.employee_records where membership_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  2,
  'el manager ve su propia ficha con su historial'
);

-- ── Admin (people.sensitive): ve y edita ─────────────────────
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');

select ok(
  (select count(distinct membership_id) from public.employee_records) >= 5,
  'una admin ve las fichas de toda la organización'
);
select lives_ok(
  $$ insert into public.employee_records (org_id, membership_id, effective_from, salary_annual, contract_type)
     values ('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', current_date + 30, 38000, 'indefinido') $$,
  'una admin registra un cambio con vigencia futura'
);
select is(
  (select org_id from public.employee_records
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and effective_from = current_date + 30),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'la organización se deduce de la membresía, no del cliente'
);
select throws_ok(
  $$ update public.employee_records set membership_id = 'bbbbbbbb-0000-0000-0000-000000000003'
     where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and effective_from = current_date + 30 $$,
  'membership is immutable',
  'una versión no se puede reasignar a otra persona'
);

-- ── Otra organización: Laura es empleada en Orbital ──────────
select pg_temp.login_as('11111111-1111-1111-1111-111111111111', 'laura@demo.com');
select is(
  (select count(*)::int from public.employee_records where org_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'sin people.sensitive en Orbital, no se ven fichas de Orbital'
);

select * from finish();
rollback;
