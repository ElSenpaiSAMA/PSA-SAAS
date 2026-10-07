-- OT recurrentes por proyecto (pgTAP). Arma sus propios proyectos y OT del mes pasado.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

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

-- Dos proyectos del Taller con una OT el mes pasado: uno mensual y otro puntual
insert into public.projects (id, org_id, name, department_id) values
  ('55555555-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'PGTAP Mantenimiento mensual', 'eeeeeeee-0000-0000-0000-000000000002'),
  ('55555555-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', 'PGTAP Refit puntual', 'eeeeeeee-0000-0000-0000-000000000002');
insert into public.work_orders (project_id, title, period_start, period_end, budgeted_hours) values
  ('55555555-0000-0000-0000-0000000000a1', 'Mantenimiento · mes pasado',
   (date_trunc('month', current_date) - interval '1 month')::date, (date_trunc('month', current_date) - interval '1 day')::date, 20),
  ('55555555-0000-0000-0000-0000000000a2', 'Refit · mes pasado',
   (date_trunc('month', current_date) - interval '1 month')::date, (date_trunc('month', current_date) - interval '1 day')::date, 40);

-- ── Quién marca un proyecto como mensual ──────────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
update public.projects set recurring_work_orders = true where id = '55555555-0000-0000-0000-0000000000a1';
select pg_temp.as_system();
select is(
  (select recurring_work_orders from public.projects where id = '55555555-0000-0000-0000-0000000000a1'),
  false,
  'una empleada no cambia si un proyecto es mensual'
);

select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');
select lives_ok(
  $$ update public.projects set recurring_work_orders = true where id = '55555555-0000-0000-0000-0000000000a1' $$,
  'el responsable del departamento lo marca como mensual'
);

-- ── El día 1: se renuevan solo los proyectos mensuales ────────
select pg_temp.as_system();
select is(public.automation_work_orders_recurring('aaaaaaaa-0000-0000-0000-000000000001', '{}'::jsonb, true) >= 1, true,
  'la automatización del mes crea OT');
select is(
  (select count(*)::int from public.work_orders
   where project_id = '55555555-0000-0000-0000-0000000000a1' and period_start = date_trunc('month', current_date)::date),
  1,
  'el proyecto mensual tiene su OT del mes nuevo'
);
select is(
  (select count(*)::int from public.work_orders
   where project_id = '55555555-0000-0000-0000-0000000000a2' and period_start = date_trunc('month', current_date)::date),
  0,
  'el proyecto puntual no se renueva'
);
select is(
  (select status from public.work_orders
   where project_id = '55555555-0000-0000-0000-0000000000a1' and period_start = date_trunc('month', current_date)::date),
  'draft',
  'la OT renovada queda en borrador para que alguien la revise'
);

select * from finish();
rollback;
