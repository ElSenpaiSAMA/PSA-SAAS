-- Correcciones de fichaje (pgTAP) sobre el seed demo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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

-- Un día de hace un mes sin fichajes de Diego (no se superpone con el seed de las últimas 2 semanas)
create or replace function pg_temp.day() returns date language sql as $$ select current_date - 30 $$;
create or replace function pg_temp.at(p_hour int) returns timestamptz language sql as $$
  select (pg_temp.day() + make_time(p_hour, 0, 0))::timestamp at time zone 'Europe/Madrid'
$$;

-- ── Diego pide agregar un fichaje olvidado ───────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');

select throws_ok(
  $$ insert into public.time_corrections (membership_id, proposed_start, proposed_end, reason)
     values ('bbbbbbbb-0000-0000-0000-000000000004', now() + interval '1 hour', now() + interval '2 hours', 'Futuro') $$,
  'corrections cannot end in the future',
  'no se pueden corregir horas que todavía no pasaron'
);

select lives_ok(
  $$ insert into public.time_corrections (membership_id, proposed_start, proposed_end, reason)
     values ('bbbbbbbb-0000-0000-0000-000000000004', pg_temp.at(9), pg_temp.at(17), 'Me olvidé de fichar') $$,
  'pedir un fichaje olvidado'
);

select throws_ok(
  $$ insert into public.time_corrections (membership_id, proposed_start, proposed_end, reason)
     values ('bbbbbbbb-0000-0000-0000-000000000004', pg_temp.at(10), pg_temp.at(12), 'Otra vez') $$,
  'there is already a pending correction for that time',
  'no se puede pedir dos veces lo mismo'
);

select throws_ok(
  $$ update public.time_corrections set status = 'approved' where reason = 'Me olvidé de fichar' $$,
  'you cannot decide on your own correction',
  'nadie aprueba su propia corrección'
);

-- ── Ana no ve las correcciones de Diego ──────────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select is((select count(*)::int from public.time_corrections), 0, 'una compañera no ve correcciones ajenas');

-- ── Carlos (su manager) decide ───────────────────────────────
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');
select is((select count(*)::int from public.time_corrections where reason = 'Me olvidé de fichar'), 1,
  'el manager ve la corrección de su equipo');
select throws_ok(
  $$ update public.time_corrections set status = 'rejected' where reason = 'Me olvidé de fichar' $$,
  'a rejection requires a reason',
  'rechazar exige motivo'
);
select lives_ok(
  $$ update public.time_corrections set status = 'approved' where reason = 'Me olvidé de fichar' $$,
  'aprobar la corrección'
);

reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*)::int from public.time_entries
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and entry_type = 'clock'
     and started_at = pg_temp.at(9) and ended_at = pg_temp.at(17)),
  1,
  'al aprobarse, el fichaje olvidado queda registrado con esas horas'
);
select is(
  (select count(*)::int from public.notifications
   where recipient_id = 'bbbbbbbb-0000-0000-0000-000000000004' and kind = 'time.correction_decided'),
  1,
  'la persona recibe el aviso de la decisión'
);

-- ── Corregir un tramo existente ──────────────────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
insert into public.time_corrections (membership_id, entry_id, proposed_start, proposed_end, reason)
select 'bbbbbbbb-0000-0000-0000-000000000004', id, pg_temp.at(8), pg_temp.at(16), 'Entré antes'
from public.time_entries
where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and started_at = pg_temp.at(9);

select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');
update public.time_corrections set status = 'approved' where reason = 'Entré antes';

reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select started_at from public.time_entries
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and entry_type = 'clock' and ended_at = pg_temp.at(16)),
  pg_temp.at(8),
  'corregir un tramo cambia su entrada y su salida'
);

-- El fichaje sigue sin poder editarse a mano
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select throws_ok(
  $$ update public.time_entries set started_at = started_at - interval '1 hour'
     where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and entry_type = 'clock' and ended_at = pg_temp.at(16) $$,
  'clock-in time cannot be modified',
  'a mano, el fichaje sigue siendo inmodificable'
);

select * from finish();
rollback;
