-- Foro interno (pgTAP). Crea sus propios hilos: no depende de los datos del seed.
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

-- ── Ana (empleada de Nébula) abre un hilo ────────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');

select lives_ok(
  $$ insert into public.forum_threads (author_id, category, title, body, pinned)
     values ('bbbbbbbb-0000-0000-0000-000000000003', 'question', 'Duda de prueba sobre antifouling', '¿Qué antifouling usamos?', true) $$,
  'una empleada abre un hilo'
);
select is((select org_id from public.forum_threads where title = 'Duda de prueba sobre antifouling'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'la empresa del hilo sale de quien lo escribe');
select is((select pinned from public.forum_threads where title = 'Duda de prueba sobre antifouling'), false,
  'una empleada no puede crear un hilo fijado');
select throws_ok(
  $$ insert into public.forum_threads (author_id, category, title, body)
     values ('bbbbbbbb-0000-0000-0000-000000000004', 'question', 'Hilo a nombre de otro', 'x') $$,
  '42501', null,
  'nadie escribe a nombre de otra persona'
);

-- ── Diego responde; a Ana le llega el aviso ──────────────────
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
insert into public.forum_posts (thread_id, author_id, body)
select id, 'bbbbbbbb-0000-0000-0000-000000000004', 'Usamos el de cobre autopulimentante.'
from public.forum_threads where title = 'Duda de prueba sobre antifouling';

select is((select reply_count from public.forum_threads where title = 'Duda de prueba sobre antifouling'), 1,
  'responder suma al contador del hilo');
update public.forum_threads set title = 'Título cambiado por otro' where title = 'Duda de prueba sobre antifouling';
select is((select count(*)::int from public.forum_threads where title = 'Título cambiado por otro'), 0,
  'solo el autor edita el hilo');

reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*)::int from public.notifications n join public.forum_threads t on t.id = n.entity_id
   where t.title = 'Duda de prueba sobre antifouling' and n.kind = 'forum.reply' and n.recipient_id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  1,
  'la autora recibe el aviso de la respuesta'
);

-- ── Moderación (Sofía, admin) ────────────────────────────────
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select lives_ok(
  $$ update public.forum_threads set pinned = true, locked = true where title = 'Duda de prueba sobre antifouling' $$,
  'moderación fija y cierra un hilo'
);

select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select throws_ok(
  $$ insert into public.forum_posts (thread_id, author_id, body)
     select id, 'bbbbbbbb-0000-0000-0000-000000000004', 'Otra respuesta' from public.forum_threads where title = 'Duda de prueba sobre antifouling' $$,
  'thread is locked',
  'en un hilo cerrado no se puede responder'
);
-- Ni siquiera la autora lo reabre: cerrar y reabrir es cosa de moderación
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select throws_ok(
  $$ update public.forum_threads set locked = false where title = 'Duda de prueba sobre antifouling' $$,
  'only moderators can pin or lock threads',
  'la autora no reabre un hilo cerrado por moderación'
);

-- ── Avisos para toda la empresa ──────────────────────────────
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
insert into public.forum_threads (author_id, category, title, body)
values ('bbbbbbbb-0000-0000-0000-000000000005', 'notice', 'Aviso de prueba para todos', 'El taller cierra a las 15 h.');
reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select count(distinct n.recipient_id)::int from public.notifications n join public.forum_threads t on t.id = n.entity_id
   where t.title = 'Aviso de prueba para todos' and n.kind = 'forum.notice'),
  (select count(*)::int - 1 from public.memberships
   where org_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'active' and role_id <> 'superadmin'
     and public.membership_can(id, 'workspace.access')),
  'un aviso le llega a toda la empresa (menos a quien lo publica, a los externos y al superadmin)'
);

-- ── Otra empresa no ve nada ──────────────────────────────────
-- Carlos es owner de Orbital y manager en Nébula; Laura es empleada de Orbital.
-- Una persona que solo está en Orbital no debería ver el foro de Nébula: se crea una membresía de prueba.
insert into auth.users (id, email, encrypted_password, aud, role, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values ('66666666-6666-6666-6666-666666666666', 'solo-orbital@demo.test', '', 'authenticated', 'authenticated', '{}', now(), now(), now());
insert into public.memberships (org_id, user_id, role_id) values ('aaaaaaaa-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666', 'employee');

select pg_temp.login_as('66666666-6666-6666-6666-666666666666', 'solo-orbital@demo.test');
select is((select count(*)::int from public.forum_threads where org_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'alguien de otra empresa no ve los hilos');
select is((select count(*)::int from public.forum_posts where org_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'ni sus respuestas');

-- ── Sin sesión, nada ─────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select is((select count(*)::int from public.forum_threads), 0, 'sin iniciar sesión no se lee el foro');

select * from finish();
rollback;
