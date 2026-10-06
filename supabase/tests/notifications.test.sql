-- Notificaciones (pgTAP) sobre el seed demo.
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

-- Cuenta como superusuario (sin RLS) para verificar destinatarios
create or replace function pg_temp.count_for(p_recipient uuid, p_kind text)
returns int
language plpgsql
security definer
as $$
declare n int;
begin
  select count(*) into n from public.notifications where recipient_id = p_recipient and kind = p_kind;
  return n;
end;
$$;

-- ── Quién aprueba ────────────────────────────────────────────
select is(
  (select array_agg(x) from public.vacation_approvers('bbbbbbbb-0000-0000-0000-000000000004') x),
  array['bbbbbbbb-0000-0000-0000-000000000002'::uuid],
  'las vacaciones de Diego las aprueba su manager (Carlos)'
);
select is(
  (select array_agg(x order by x) from public.vacation_approvers('bbbbbbbb-0000-0000-0000-000000000001') x),
  array['bbbbbbbb-0000-0000-0000-000000000005'::uuid],
  'sin responsable por encima (la CEO), aprueba administración (Sofía)'
);

-- ── Diego pide vacaciones → avisa a Carlos ───────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
insert into public.vacation_requests (membership_id, start_date, end_date, reason)
values ('bbbbbbbb-0000-0000-0000-000000000004', current_date + 90, current_date + 91, 'Test');

reset role;
select is(
  (select array_agg(n.recipient_id) from public.notifications n
   join public.vacation_requests v on v.id = n.entity_id
   where n.kind = 'vacation.requested' and v.reason = 'Test'),
  array['bbbbbbbb-0000-0000-0000-000000000002'::uuid],
  'solo Carlos recibe el aviso: administración no, porque Diego ya tiene responsable'
);
select is(
  (select n.link from public.notifications n join public.vacation_requests v on v.id = n.entity_id
   where n.kind = 'vacation.requested' and v.reason = 'Test'),
  '/app/aaaaaaaa-0000-0000-0000-000000000001/vacations?tab=equipo',
  'el aviso lleva a Vacaciones → Equipo, donde se decide'
);
select is(
  (select array_agg(x) from public.vacation_approvers('bbbbbbbb-0000-0000-0000-000000000003') x),
  array['bbbbbbbb-0000-0000-0000-000000000002'::uuid],
  'las vacaciones de Ana también las aprueba Carlos'
);

-- ── Privacidad ───────────────────────────────────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select is(
  (select count(*)::int from public.notifications where recipient_id <> 'bbbbbbbb-0000-0000-0000-000000000004'),
  0,
  'Diego no ve notificaciones de otros'
);
select throws_ok(
  $$ insert into public.notifications (org_id, recipient_id, kind, title)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'fake', 'Aviso falso') $$,
  '42501', null,
  'el cliente no puede fabricar notificaciones'
);
select throws_ok(
  $$ select public.notify('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'fake', 'x', null, null, null, null) $$,
  '42501', null,
  'notify() no se puede llamar desde el cliente'
);

-- ── Carlos aprueba → avisa a Diego ───────────────────────────
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');
update public.vacation_requests set status = 'approved'
where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and reason = 'Test';

select is(
  (select count(*)::int from public.notifications where recipient_id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  0,
  'Carlos no ve el aviso dirigido a Diego'
);

select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select is(
  (select title from public.notifications where kind = 'vacation.decided' order by created_at desc limit 1),
  'Aprobaron tu solicitud de vacaciones',
  'Diego recibe la decisión'
);

-- Solo se puede marcar como leída
select lives_ok(
  $$ update public.notifications set read_at = now() where kind = 'vacation.decided' $$,
  'marcar como leída'
);
select throws_ok(
  $$ update public.notifications set title = 'Editado' where kind = 'vacation.decided' $$,
  'only read_at can be changed',
  'el contenido de una notificación es inmutable'
);

-- ── Tarea asignada y OT por facturar ─────────────────────────
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');
update public.tasks set assigned_to = 'bbbbbbbb-0000-0000-0000-000000000004'
where id = (
  select t.id from public.tasks t
  join public.work_orders w on w.id = t.work_order_id
  where t.org_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and w.status in ('approved', 'in_progress') and w.billing_status = 'unbilled'
    and t.assigned_to is distinct from 'bbbbbbbb-0000-0000-0000-000000000004'
  order by t.title limit 1
);
update public.work_orders set status = 'closed'
where id = (
  select id from public.work_orders
  where org_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'in_progress' and billing_status = 'unbilled'
  order by number limit 1
);

reset role;
select is(pg_temp.count_for('bbbbbbbb-0000-0000-0000-000000000004', 'task.assigned') >= 1, true,
  'al reasignar una tarea se avisa a la nueva persona');
select is(
  (select count(distinct recipient_id)::int from public.notifications
   where kind = 'work_order.to_invoice' and created_at = now()),
  2,
  'una OT cerrada avisa a quienes facturan (owner y admin)'
);

select * from finish();
rollback;
