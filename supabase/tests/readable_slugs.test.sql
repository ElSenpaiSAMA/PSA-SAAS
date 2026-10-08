-- URL legibles: slugs de proyectos, OT y personas (pgTAP). Arma sus propios datos.
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

create or replace function pg_temp.as_system()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

select is(public.slugify('Climatización Princess V58'), 'climatizacion-princess-v58', 'slugify: minúsculas, sin tildes y con guiones');

-- ── Proyectos ─────────────────────────────────────────────────
insert into public.projects (id, org_id, name) values
  ('66666666-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'PGTAP Refit Azimut 55'),
  ('66666666-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', 'PGTAP Refit Azimut 55'),
  ('66666666-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000002', 'PGTAP Refit Azimut 55');

select is((select slug from public.projects where id = '66666666-0000-0000-0000-0000000000a1'), 'pgtap-refit-azimut-55', 'el proyecto toma el slug de su nombre');
select is((select slug from public.projects where id = '66666666-0000-0000-0000-0000000000a2'), 'pgtap-refit-azimut-55-2', 'un nombre repetido en la empresa lleva -2');
select is((select slug from public.projects where id = '66666666-0000-0000-0000-0000000000a3'), 'pgtap-refit-azimut-55', 'otra empresa puede usar el mismo slug');

update public.projects set name = 'PGTAP Refit Azimut 55 Fly' where id = '66666666-0000-0000-0000-0000000000a2';
select is((select slug from public.projects where id = '66666666-0000-0000-0000-0000000000a2'), 'pgtap-refit-azimut-55-fly', 'al renombrar, cambia el slug');

update public.projects set slug = 'otro-nombre' where id = '66666666-0000-0000-0000-0000000000a1';
select is((select slug from public.projects where id = '66666666-0000-0000-0000-0000000000a1'), 'pgtap-refit-azimut-55', 'el slug no se fija a mano');

-- ── Órdenes de trabajo ────────────────────────────────────────
insert into public.work_orders (id, project_id, title, period_start, period_end) values
  ('77777777-0000-0000-0000-0000000000a1', '66666666-0000-0000-0000-0000000000a1', 'Azimut 55 · Marzo 2031', '2031-03-01', '2031-03-31');
select is((select slug from public.work_orders where id = '77777777-0000-0000-0000-0000000000a1'), 'azimut-55-marzo-2031', 'la OT toma el slug de su título');

-- ── Personas ──────────────────────────────────────────────────
update public.profiles set full_name = 'Pgtap Ana Torres' where id = '33333333-3333-3333-3333-333333333333';
select is(
  (select slug from public.memberships where user_id = '33333333-3333-3333-3333-333333333333' and org_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'pgtap-ana-torres',
  'al cambiar el nombre de una persona, cambia su slug'
);

-- Una persona puede disparar el recálculo de su propio slug (no es un cambio de rol), pero no elegirlo
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select lives_ok(
  $$ update public.memberships set slug = 'jefa' where user_id = '33333333-3333-3333-3333-333333333333' $$,
  'tocar solo el slug no choca con el control de cambios de memberships'
);
select pg_temp.as_system();
select is(
  (select slug from public.memberships where user_id = '33333333-3333-3333-3333-333333333333' and org_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'pgtap-ana-torres',
  'el slug de una persona tampoco se fija a mano'
);

select * from finish();
rollback;
