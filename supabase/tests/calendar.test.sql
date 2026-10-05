-- Festivos y ausencias para el calendario (pgTAP) sobre el seed demo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

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

create or replace function pg_temp.y() returns int language sql as $$ select extract(year from current_date)::int $$;

-- ── Días hábiles con festivos ────────────────────────────────
-- El 12 de octubre (Fiesta Nacional) está cargado como festivo en Nébula, no en Orbital
select is(
  public.business_days(make_date(pg_temp.y(), 10, 12), make_date(pg_temp.y(), 10, 12), 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'un festivo no es día hábil'
);

select is(
  public.business_days(make_date(pg_temp.y(), 10, 12), make_date(pg_temp.y(), 10, 12), 'aaaaaaaa-0000-0000-0000-000000000002'),
  case when extract(isodow from make_date(pg_temp.y(), 10, 12)) < 6 then 1 else 0 end,
  'los festivos son por organización'
);

-- ── Empleado ─────────────────────────────────────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');

select ok(
  (select count(*) from public.holidays) >= 9,
  'un empleado ve los festivos de su organización'
);

select throws_ok(
  $$ insert into public.holidays (org_id, date, name)
     values ('aaaaaaaa-0000-0000-0000-000000000001', make_date(2030, 3, 19), 'San José') $$,
  '42501',
  null,
  'un empleado no puede crear festivos'
);

select ok(
  (select count(*) from public.org_absences('aaaaaaaa-0000-0000-0000-000000000001', make_date(pg_temp.y(), 1, 1), make_date(pg_temp.y(), 12, 31))
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000003' and status = 'approved') >= 1,
  'un empleado ve las vacaciones aprobadas de sus compañeros'
);

select is(
  (select count(*)::int from public.org_absences('aaaaaaaa-0000-0000-0000-000000000001', current_date - 400, current_date + 400)
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000003' and status = 'pending'),
  0,
  'pero no las pendientes de alguien que no supervisa'
);

select is(
  (select count(*)::int from public.org_absences('aaaaaaaa-0000-0000-0000-000000000002', current_date - 400, current_date + 400)),
  0,
  'no ve ausencias de una organización ajena'
);

-- ── Manager y admin ──────────────────────────────────────────
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');

select ok(
  (select count(*) from public.org_absences('aaaaaaaa-0000-0000-0000-000000000001', current_date - 400, current_date + 400)
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000003' and status = 'pending') >= 1,
  'el manager ve las vacaciones pendientes de su equipo'
);

select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');

select lives_ok(
  $$ insert into public.holidays (org_id, date, name)
     values ('aaaaaaaa-0000-0000-0000-000000000001', make_date(2030, 3, 19), 'San José') $$,
  'una admin crea festivos'
);

select * from finish();
rollback;
