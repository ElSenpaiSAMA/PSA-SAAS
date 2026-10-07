-- Una sola empresa: sin organizaciones nuevas y alta solo con invitación (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- ── Nadie crea organizaciones desde la app ───────────────────
select ok(
  not has_function_privilege('authenticated', 'public.create_organization(text)', 'execute'),
  'un usuario no puede crear organizaciones'
);
select ok(
  not has_function_privilege('anon', 'public.create_organization(text)', 'execute'),
  'sin sesión tampoco'
);

-- ── Registro sin invitación: no permitido ───────────────────
select ok(not public.signup_allowed('sin-invitacion@pruebas.test'), 'sin invitación no se puede registrar');

-- ── Con invitación: se registra y entra a la empresa con su rol ─
insert into public.invitations (org_id, email, role_id, position)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Tecnica.Nueva@Pruebas.test', 'employee', 'Técnica de climatización');

select ok(public.signup_allowed('TECNICA.nueva@pruebas.test'), 'con invitación sí (sin importar mayúsculas)');

select lives_ok(
  $$ insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at)
     values ('88888888-8888-8888-8888-888888888888', 'tecnica.nueva@pruebas.test', 'authenticated', 'authenticated', '{"full_name":"Técnica Nueva"}', now(), now()) $$,
  'al registrarse se crea la cuenta'
);

select is(
  (select role_id || ' · ' || position from public.memberships
   where user_id = '88888888-8888-8888-8888-888888888888' and org_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'employee · Técnica de climatización',
  'entra a la empresa con el rol y el puesto de la invitación'
);
select ok(
  (select accepted_at is not null from public.invitations where lower(email) = 'tecnica.nueva@pruebas.test'),
  'la invitación queda aceptada'
);

-- ── Las cargas del sistema (seed) no pasan por la regla ──────
select lives_ok(
  $$ insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at)
     values ('99999999-9999-9999-9999-999999999999', 'carga@pruebas.test', 'authenticated', 'authenticated', '{}', now(), now()) $$,
  'el seed puede crear usuarios sin invitación'
);

select * from finish();
rollback;
