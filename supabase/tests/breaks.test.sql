-- Pausas en el fichaje (pgTAP) sobre el seed demo.
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

create or replace function pg_temp.open_count(p_type text)
returns int
language sql
as $$
  select count(*)::int from public.time_entries
  where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004' and entry_type = p_type and ended_at is null
$$;

-- Diego (empleado de Nébula)
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');

select throws_ok(
  $$ select public.clock_pause('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'not clocked in',
  'no se puede pausar sin haber fichado'
);

insert into public.time_entries (membership_id, entry_type) values ('bbbbbbbb-0000-0000-0000-000000000004', 'clock');

select lives_ok(
  $$ select public.clock_pause('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'pausar con el fichaje abierto'
);
select is(pg_temp.open_count('clock'), 0, 'al pausar se cierra el tramo de trabajo');
select is(pg_temp.open_count('break'), 1, 'y queda una pausa abierta');

select throws_ok(
  $$ insert into public.time_entries (membership_id, entry_type) values ('bbbbbbbb-0000-0000-0000-000000000004', 'clock') $$,
  'clock and break cannot be open at the same time',
  'no se puede fichar entrada estando en pausa: hay que reanudar'
);

select lives_ok(
  $$ select public.clock_resume('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'reanudar desde la pausa'
);
select ok(pg_temp.open_count('clock') = 1 and pg_temp.open_count('break') = 0, 'al reanudar se cierra la pausa y se abre un tramo nuevo');

select throws_ok(
  $$ select public.clock_resume('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'not on break',
  'no se puede reanudar sin estar en pausa'
);

-- Una pausa no se puede hacer en nombre de otra organización a la que no pertenece
select throws_ok(
  $$ select public.clock_pause('aaaaaaaa-0000-0000-0000-000000000002') $$,
  'not a member of this organization',
  'pausar exige ser miembro de la organización'
);

select * from finish();
rollback;
