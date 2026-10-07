-- Órdenes de trabajo, períodos, facturación y planificación (pgTAP) sobre el seed demo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

create or replace function pg_temp.m0() returns date language sql as $$ select date_trunc('month', current_date)::date $$;
create or replace function pg_temp.m_end() returns date language sql as $$ select (date_trunc('month', current_date) + interval '1 month - 1 day')::date $$;

-- OT del seed: f..01 Portal mes anterior (cerrada y facturada), f..02 Portal mes actual (en curso),
-- f..03 Lagoon mes actual (en curso), f..04 Formación mes actual (aprobada)

select results_eq(
  $$ select number from public.work_orders where org_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by number $$,
  $$ values (1), (2), (3), (4) $$,
  'las OT se numeran de forma correlativa por organización'
);

-- ── Empleada ─────────────────────────────────────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');

select is(
  (select count(*)::int from public.work_orders),
  2,
  'una empleada solo ve las OT de sus proyectos'
);

select throws_ok(
  $$ insert into public.work_orders (project_id, title, period_start, period_end)
     values ('cccccccc-0000-0000-0000-000000000001', 'Intento', current_date, current_date) $$,
  '42501',
  null,
  'una empleada no puede crear OT'
);

select throws_ok(
  $$ insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
     values ('bbbbbbbb-0000-0000-0000-000000000003', 'task', 'dddddddd-0000-0000-0000-000000000008',
             now() - interval '2 hours', now() - interval '1 hour') $$,
  'P0001',
  'work order is not open for time entries',
  'no se imputan horas a una OT cerrada'
);

select lives_ok(
  $$ insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
     values ('bbbbbbbb-0000-0000-0000-000000000003', 'task', 'dddddddd-0000-0000-0000-000000000002',
             now() - interval '2 hours', now() - interval '1 hour') $$,
  'se imputan horas a una OT en curso'
);

select is(
  (select count(*)::int from public.workload_items('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.m0(), pg_temp.m_end())
   where membership_id <> 'bbbbbbbb-0000-0000-0000-000000000003'),
  0,
  'una empleada solo ve su propia carga planificada'
);

-- ── Admin: la primera imputación pasa una OT aprobada a "en curso" ──
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');

select lives_ok(
  $$ insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
     values ('bbbbbbbb-0000-0000-0000-000000000005', 'task', 'dddddddd-0000-0000-0000-000000000007',
             now() - interval '3 hours', now() - interval '2 hours') $$,
  'se imputan horas a una OT aprobada'
);

select is(
  (select status from public.work_orders where id = 'ffffffff-0000-0000-0000-000000000004'),
  'in_progress',
  'la primera imputación pasa la OT a en curso'
);

-- ── Responsable: duplicar la OT del mes anterior ─────────────
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');

create temporary table copied as
select public.duplicate_work_order(
  'ffffffff-0000-0000-0000-000000000001',
  'Princess V58 · copia',
  (pg_temp.m0() + interval '1 month')::date,
  (pg_temp.m0() + interval '2 months - 1 day')::date
) as id;

select is(
  (select status from public.work_orders where id = (select id from copied)),
  'draft',
  'la OT duplicada nace en borrador'
);

select is(
  (select count(*)::int from public.tasks where work_order_id = (select id from copied) and status = 'todo'),
  3,
  'la OT duplicada copia todas las tareas, reiniciadas'
);

select ok(
  (select bool_and(start_date >= (pg_temp.m0() + interval '1 month')::date)
   from public.tasks where work_order_id = (select id from copied)),
  'las fechas de las tareas copiadas se corren al nuevo período'
);

select throws_ok(
  $$ update public.work_orders set billing_status = 'invoiced' where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  'P0001',
  'billing changes require billing permission',
  'un responsable sin permiso de facturación no puede facturar'
);

select is(
  (select count(distinct membership_id)::int
   from public.workload_items('aaaaaaaa-0000-0000-0000-000000000001', pg_temp.m0(), pg_temp.m_end())
   where membership_id in ('bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004')),
  2,
  'el responsable ve la carga planificada de su equipo'
);

-- ── Facturación ──────────────────────────────────────────────
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');

select throws_ok(
  $$ update public.work_orders set billing_status = 'invoiced' where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  'P0001',
  'only closed work orders can be invoiced',
  'solo se factura una OT cerrada'
);

select lives_ok(
  $$ update public.work_orders set status = 'closed' where id = 'ffffffff-0000-0000-0000-000000000002';
     update public.work_orders set billing_status = 'invoiced' where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  'una admin cierra y factura la OT'
);

select throws_ok(
  $$ update public.work_orders set budgeted_hours = 500 where id = 'ffffffff-0000-0000-0000-000000000002' $$,
  'P0001',
  'invoiced work orders are locked',
  'una OT facturada queda bloqueada'
);

select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');

select throws_ok(
  $$ insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
     values ('bbbbbbbb-0000-0000-0000-000000000003', 'task', 'dddddddd-0000-0000-0000-000000000002',
             now() - interval '5 hours', now() - interval '4 hours') $$,
  'P0001',
  'work order is not open for time entries',
  'tras cerrar la OT ya no se imputan horas'
);

select * from finish();
rollback;
