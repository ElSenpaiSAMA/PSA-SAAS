-- Eliminar a una persona (pgTAP).
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

-- ── Quién puede ───────────────────────────────────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select throws_ok(
  $$ select public.delete_member('bbbbbbbb-0000-0000-0000-000000000109') $$,
  'not allowed to delete this member',
  'una empleada no elimina a nadie'
);

select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select throws_ok(
  $$ select public.delete_member('bbbbbbbb-0000-0000-0000-000000000005') $$,
  'you cannot delete yourself',
  'nadie se elimina a sí mismo'
);
select throws_ok(
  $$ select public.delete_member('bbbbbbbb-0000-0000-0000-000000000001') $$,
  'insufficient rank for this change',
  'la directora de RRHH no elimina a la CEO'
);

-- ── Eliminar: la cuenta y todos sus datos ─────────────────────
select lives_ok(
  $$ select public.delete_member('bbbbbbbb-0000-0000-0000-000000000109') $$,
  'quien gestiona personas elimina a alguien de nivel menor'
);
select pg_temp.as_system();
select is((select count(*)::int from public.memberships where id = 'bbbbbbbb-0000-0000-0000-000000000109'), 0, 'se borra su membresía');
select is((select count(*)::int from auth.users where id = '10000000-0000-0000-0000-000000000009'), 0, 'y su cuenta');
select is((select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000009'), 0, 'y su perfil');
select is(
  (select count(*)::int from public.audit_log
   where action = 'member.deleted' and metadata ->> 'email' = 'ivan@demo.com'),
  1,
  'queda en la auditoría quién era'
);

-- ── Aunque tenga historia: decidió vacaciones y tiene fichajes ──
-- Carlos decidió vacaciones de Ana (seed) y tiene horas imputadas
select pg_temp.login_as('11111111-1111-1111-1111-111111111111', 'laura@demo.com');
select lives_ok(
  $$ select public.delete_member('bbbbbbbb-0000-0000-0000-000000000002') $$,
  'la CEO elimina a alguien con historia (vacaciones decididas, fichajes, equipo a cargo)'
);
select pg_temp.as_system();
select is(
  (select count(*)::int from public.vacation_requests
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000003' and status = 'approved' and decided_by is null),
  (select count(*)::int from public.vacation_requests
   where membership_id = 'bbbbbbbb-0000-0000-0000-000000000003' and status = 'approved'),
  'las vacaciones que decidió se conservan, sin firmante'
);

select * from finish();
rollback;
