-- Tipos de ausencia y motivo de rechazo (pgTAP) sobre el seed demo.
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

create or replace function pg_temp.used_days()
returns int
language sql
security definer
as $$ select used_days from public.vacation_balances where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' $$;

-- ── Diego pide una baja médica y unos días de vacaciones ─────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');

insert into public.vacation_requests (membership_id, start_date, end_date, reason)
values ('bbbbbbbb-0000-0000-0000-000000000004', current_date + 120, current_date + 121, 'tipo-defecto');
select is((select kind from public.vacation_requests where reason = 'tipo-defecto'), 'vacation',
  'sin indicar tipo, una solicitud es de vacaciones');

insert into public.vacation_requests (membership_id, start_date, end_date, kind, reason)
values ('bbbbbbbb-0000-0000-0000-000000000004', date_trunc('year', current_date)::date + 150, date_trunc('year', current_date)::date + 160, 'sick', 'baja');

select throws_ok(
  $$ update public.vacation_requests set kind = 'vacation' where reason = 'baja' $$,
  'request dates, type and owner are immutable',
  'el tipo no se puede cambiar después de pedirla'
);

-- ── Carlos decide ────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
create temp table before_used as select pg_temp.used_days() as n;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');
update public.vacation_requests set status = 'approved' where reason = 'baja';

reset role;
select is(pg_temp.used_days(), (select n from before_used),
  'una baja médica aprobada no descuenta días de vacaciones');

select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');
select throws_ok(
  $$ update public.vacation_requests set status = 'rejected' where reason = 'tipo-defecto' $$,
  'a rejection requires a reason',
  'rechazar sin motivo no está permitido'
);
select lives_ok(
  $$ update public.vacation_requests set status = 'rejected', decision_note = 'Cierre de proyecto esa semana' where reason = 'tipo-defecto' $$,
  'rechazar con motivo'
);

-- ── Lo que ve Diego ──────────────────────────────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select is(
  (select body from public.notifications n join public.vacation_requests v on v.id = n.entity_id
   where v.reason = 'tipo-defecto' and n.kind = 'vacation.decided'),
  public.fmt_range(current_date + 120, current_date + 121) || ' · Carlos Ruiz · «Cierre de proyecto esa semana»',
  'el aviso de rechazo incluye el motivo'
);
select is(
  (select title from public.notifications n join public.vacation_requests v on v.id = n.entity_id
   where v.reason = 'baja' and n.kind = 'vacation.decided'),
  'Aprobaron tu solicitud de una baja médica',
  'el aviso dice el tipo de ausencia'
);

-- ── El calendario de toda la empresa no expone el tipo ───────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select ok(
  exists (select 1 from public.org_absences('aaaaaaaa-0000-0000-0000-000000000001', date_trunc('year', current_date)::date, current_date + 400)
          where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  'una compañera ve que Diego estará ausente'
);
select is(
  (select count(*)::int from public.vacation_requests where reason = 'baja'),
  0,
  'pero no ve la solicitud ni su tipo'
);

select * from finish();
rollback;
