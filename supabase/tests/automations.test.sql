-- Motor de automatizaciones (pgTAP) sobre el seed demo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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

-- Próximo día hábil a partir de N días (para que la prueba no dependa de la fecha)
create or replace function pg_temp.workday(p_from int)
returns date
language sql
as $$
  select d::date from generate_series(current_date + p_from, current_date + p_from + 14, interval '1 day') d
  where extract(isodow from d) < 6
    and not exists (select 1 from public.holidays h where h.date = d::date)
  order by d limit 1
$$;

-- ── Configuración y permisos ─────────────────────────────────
select is(
  (select enabled from public.automation_config('aaaaaaaa-0000-0000-0000-000000000001', 'vacations.auto_approve_short')),
  false,
  'sin configurar, rige el valor por defecto del catálogo'
);

select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select throws_ok(
  $$ insert into public.automation_rules (org_id, key, enabled) values ('aaaaaaaa-0000-0000-0000-000000000001', 'vacations.auto_approve_short', true) $$,
  '42501', null,
  'un empleado no puede configurar automatizaciones'
);
select throws_ok(
  $$ select public.run_automation_now('aaaaaaaa-0000-0000-0000-000000000001', 'tasks.due_reminder') $$,
  'not allowed',
  'un empleado no puede ejecutarlas'
);

select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select lives_ok(
  $$ insert into public.automation_rules (org_id, key, enabled, params)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'vacations.auto_approve_short', true, '{"max_days": 1, "min_notice_days": 2}') $$,
  'una admin activa la aprobación automática'
);
select is(
  (select params ->> 'max_days' from public.automation_config('aaaaaaaa-0000-0000-0000-000000000001', 'vacations.auto_approve_short')),
  '1',
  'la configuración de la empresa se combina con los valores por defecto'
);

-- ── Evento: vacaciones cortas aprobadas solas ────────────────
-- Laura (Dirección: nadie más del departamento ausente) pide 1 día con aviso suficiente
select pg_temp.login_as('11111111-1111-1111-1111-111111111111', 'laura@demo.com');
insert into public.vacation_requests (membership_id, start_date, end_date, reason)
values ('bbbbbbbb-0000-0000-0000-000000000001', pg_temp.workday(10), pg_temp.workday(10), 'auto-1');
insert into public.vacation_requests (membership_id, start_date, end_date, reason)
values ('bbbbbbbb-0000-0000-0000-000000000001', pg_temp.workday(40), pg_temp.workday(40) + 6, 'auto-largo');

reset role;
select is((select status from public.vacation_requests where reason = 'auto-1'), 'approved',
  'un día con aviso suficiente se aprueba solo');
select is((select decided_by from public.vacation_requests where reason = 'auto-1'), null,
  'la aprobación automática no se atribuye a ninguna persona');
select is(
  (select count(*)::int from public.notifications n join public.vacation_requests v on v.id = n.entity_id
   where v.reason = 'auto-1' and n.kind = 'vacation.decided' and n.recipient_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  1,
  'la solicitante recibe el aviso de aprobación'
);
select is(
  (select count(*)::int from public.notifications n join public.vacation_requests v on v.id = n.entity_id
   where v.reason = 'auto-1' and n.kind = 'vacation.requested'),
  0,
  'a nadie se le pide aprobar algo que ya se aprobó solo'
);
select is((select status from public.vacation_requests where reason = 'auto-largo'), 'pending',
  'una solicitud larga sigue el circuito normal');

-- ── Programada: fichaje olvidado ─────────────────────────────
-- Como sistema (sin sesión): el guard solo fuerza "ahora" a fichajes de usuarios
select set_config('request.jwt.claims', '', true);
insert into public.time_entries (membership_id, entry_type, started_at)
values ('bbbbbbbb-0000-0000-0000-000000000004', 'clock', now() - interval '13 hours');

select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select is(public.run_automation_now('aaaaaaaa-0000-0000-0000-000000000001', 'time.auto_close_clock'), 1,
  '"Ejecutar ahora" cierra el fichaje abierto hace más de 12 h');
select is(public.run_automation_now('aaaaaaaa-0000-0000-0000-000000000001', 'time.auto_close_clock'), 0,
  'correrla otra vez no repite la acción');

reset role;
select is(
  (select count(*)::int from public.notifications
   where recipient_id = 'bbbbbbbb-0000-0000-0000-000000000004' and kind = 'clock.auto_closed'),
  1,
  'la persona recibe el aviso del cierre'
);

-- ── Evento: presupuesto de una OT ────────────────────────────
-- Se imputan horas de sobra a una tarea de una OT abierta con presupuesto
insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
select t.assigned_to, 'task', t.id, now() - interval '200 hours', now()
from public.tasks t join public.work_orders w on w.id = t.work_order_id
where w.org_id = 'aaaaaaaa-0000-0000-0000-000000000001' and w.status in ('approved', 'in_progress')
  and w.billing_status = 'unbilled' and w.budgeted_hours > 0 and t.assigned_to is not null
order by w.number limit 1;

select ok(
  (select count(*) from public.notifications where kind = 'work_order.budget' and created_at = now()) >= 1,
  'superar el presupuesto de horas avisa a quienes gestionan la OT'
);

select * from finish();
rollback;
