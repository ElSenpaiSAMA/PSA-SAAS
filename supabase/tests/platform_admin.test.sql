-- Superadmin de plataforma y registro de errores (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

create or replace function pg_temp.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

create or replace function pg_temp.perms()
returns text[]
language sql
as $$ select coalesce(array_agg(k order by k), '{}') from public.my_permissions('aaaaaaaa-0000-0000-0000-000000000001') k $$;

-- ── El superadmin: acceso a todo (0024) ───────────────────────
select pg_temp.login_as('10000000-0000-0000-0000-000000000001', 'dev@demo.com');
select is(pg_temp.perms(), (select array_agg(key order by key) from public.permissions), 'el superadmin tiene todos los permisos');
select ok((select count(*) from public.forum_threads) > 0, 've el foro de la empresa');
select ok((select count(*) from public.projects) >= 3, 've todos los proyectos');
select ok((select count(*) from public.memberships) > 1, 've a todas las personas');
select lives_ok(
  $$ update public.profiles set muted_notifications = array['forum.notice'] where id = '10000000-0000-0000-0000-000000000001' $$,
  'el superadmin elige sus propios avisos (al resto se los configura administración)'
);

-- Configura qué gestiona cada rama
select lives_ok(
  $$ insert into public.branch_permissions (branch_id, permission_key)
     values ('dddddddd-0000-0000-0000-000000000001', 'holidays.manage') $$,
  'el superadmin configura qué gestiona cada rama'
);

-- ── El CEO: toda la empresa, pero no la plataforma ────────────
select pg_temp.login_as('11111111-1111-1111-1111-111111111111', 'laura@demo.com');
select ok('audit.view' = any (pg_temp.perms()) and not ('platform.manage' = any (pg_temp.perms())),
  'el CEO ve la auditoría pero no configura la plataforma');
select throws_ok(
  $$ insert into public.branch_permissions (branch_id, permission_key)
     values ('dddddddd-0000-0000-0000-000000000001', 'people.sensitive') $$,
  '42501', null,
  'el CEO no se da permisos a una rama (lo hace la plataforma)'
);

select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select ok('audit.view' = any (pg_temp.perms()), 'quien gestiona personas (Administración y RRHH) sigue viendo la auditoría');

-- ── Registro de errores ───────────────────────────────────────
select pg_temp.as_anon();
select lives_ok(
  $$ select public.log_error('client', 'PGTAP: algo falló en la web pública', null, 'Error: boom
    at Componente', '/contacto', '{"navegador": "test"}'::jsonb) $$,
  'cualquiera puede reportar un error (también sin sesión)'
);
select is((select count(*)::int from public.error_logs), 0, 'pero sin sesión no se pueden leer');

select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select public.log_error('action', 'PGTAP: una acción falló', 'abc123', null, '/app/x/forum', '{}'::jsonb,
  'aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.error_logs), 0, 'una empleada tampoco los lee');

select pg_temp.login_as('10000000-0000-0000-0000-000000000001', 'dev@demo.com');
select is(
  (select count(*)::int from public.error_logs where message like 'PGTAP:%'),
  2,
  'el superadmin ve todos los errores'
);
select is(
  (select org_id from public.error_logs where message = 'PGTAP: una acción falló'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'el error queda asociado a la empresa de quien lo tuvo'
);

update public.error_logs set resolved_at = now() where message = 'PGTAP: una acción falló';
select is(
  (select resolved_by from public.error_logs where message = 'PGTAP: una acción falló'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'al resolverlo queda registrado quién'
);
select throws_ok(
  $$ update public.error_logs set message = 'cambiado' where message = 'PGTAP: una acción falló' $$,
  'only the resolution of an error can be changed',
  'el contenido de un error no se puede editar'
);

select * from finish();
rollback;
