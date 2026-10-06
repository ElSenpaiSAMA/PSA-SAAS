-- Ajustes de la empresa (pgTAP) sobre el seed demo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

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

-- ── Un empleado no puede cambiar los ajustes ─────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
update public.organizations set default_weekly_hours = 10 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claims', '', true);
select isnt((select default_weekly_hours from public.organizations where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 10::numeric,
  'un empleado no puede cambiar los ajustes');

-- ── Una admin sí ─────────────────────────────────────────────
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select lives_ok(
  $$ update public.organizations set default_weekly_hours = 35, default_annual_vacation_days = 25, timezone = 'America/Argentina/Buenos_Aires'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'una admin cambia jornada, días y zona horaria'
);
select throws_ok(
  $$ update public.organizations set timezone = 'Marte/Olympus' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'invalid timezone',
  'una zona horaria inexistente se rechaza'
);
select throws_ok(
  $$ update public.organizations set name = ' X ' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'organization name must have between 2 and 60 characters',
  'el nombre tiene que tener al menos 2 caracteres'
);

-- ── Las automatizaciones usan la zona horaria de la empresa ──
select is(
  (select params ->> 'timezone' from public.automation_config('aaaaaaaa-0000-0000-0000-000000000001', 'tasks.due_reminder')),
  'America/Argentina/Buenos_Aires',
  'las automatizaciones con horario usan la zona horaria de la empresa'
);

-- ── Quien se suma recibe los valores por defecto ─────────────
reset role;
select set_config('request.jwt.claims', '', true);
-- Sofía se suma a Nébula... ya está; se suma a Orbital, con Orbital configurada
update public.organizations set default_weekly_hours = 30, default_annual_vacation_days = 24
where id = 'aaaaaaaa-0000-0000-0000-000000000002';
insert into public.memberships (org_id, user_id, role_id)
values ('aaaaaaaa-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'employee');

select is(
  (select weekly_hours from public.memberships where org_id = 'aaaaaaaa-0000-0000-0000-000000000002' and user_id = '55555555-5555-5555-5555-555555555555'),
  30::numeric,
  'la jornada de quien se suma es la de la empresa'
);
select is(
  (select annual_vacation_days from public.memberships where org_id = 'aaaaaaaa-0000-0000-0000-000000000002' and user_id = '55555555-5555-5555-5555-555555555555'),
  24::numeric,
  'y sus días de vacaciones también'
);

select * from finish();
rollback;
