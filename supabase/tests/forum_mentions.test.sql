-- Foro: menciones y novedades desde la última visita (pgTAP). Arma sus propios hilos.
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

-- Una membresía de otra empresa, para intentar mencionarla
insert into auth.users (id, email, encrypted_password, aud, role, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values ('66666666-6666-6666-6666-666666666666', 'otra-empresa@pruebas.test', '', 'authenticated', 'authenticated', '{}', now(), now(), now());
insert into public.memberships (id, org_id, user_id, role_id)
values ('bbbbbbbb-0000-0000-0000-000000000066', 'aaaaaaaa-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666666', 'employee');

-- ── Ana abre un hilo mencionando a Diego, a sí misma y a alguien de otra empresa ─
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
insert into public.forum_threads (author_id, category, title, body, mentions)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'question', 'Prueba de menciones en el foro', '@Diego Fernández ¿lo revisás?',
        array['bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000066']::uuid[]);

reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select mentions from public.forum_threads where title = 'Prueba de menciones en el foro'),
  array['bbbbbbbb-0000-0000-0000-000000000004']::uuid[],
  'solo quedan menciones a personas de la empresa, sin el autor'
);
select is(
  (select count(*)::int from public.notifications n join public.forum_threads t on t.id = n.entity_id
   where t.title = 'Prueba de menciones en el foro' and n.kind = 'forum.mention' and n.recipient_id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  1,
  'la persona mencionada recibe el aviso'
);
select is(
  (select count(*)::int from public.notifications n join public.forum_threads t on t.id = n.entity_id
   where t.title = 'Prueba de menciones en el foro' and n.kind = 'forum.mention' and n.recipient_id = 'bbbbbbbb-0000-0000-0000-000000000066'),
  0,
  'a alguien de otra empresa no le llega nada'
);

-- ── Diego responde mencionando a Ana (autora): un solo aviso ──
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
insert into public.forum_posts (thread_id, author_id, body, mentions)
select id, 'bbbbbbbb-0000-0000-0000-000000000004', '@Ana Torres listo, revisado.', array['bbbbbbbb-0000-0000-0000-000000000003']::uuid[]
from public.forum_threads where title = 'Prueba de menciones en el foro';

reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*)::int from public.notifications n join public.forum_threads t on t.id = n.entity_id
   where t.title = 'Prueba de menciones en el foro' and n.recipient_id = 'bbbbbbbb-0000-0000-0000-000000000003'
     and n.kind in ('forum.mention', 'forum.reply')),
  1,
  'la autora mencionada recibe un solo aviso (la mención), no además el de respuesta'
);
select is(
  (select last_author_id from public.forum_threads where title = 'Prueba de menciones en el foro'),
  'bbbbbbbb-0000-0000-0000-000000000004'::uuid,
  'el hilo recuerda quién respondió por última vez'
);

-- ── Al editar, las menciones no cambian ──────────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
update public.forum_threads set body = 'Texto editado', mentions = array['bbbbbbbb-0000-0000-0000-000000000005']::uuid[]
where title = 'Prueba de menciones en el foro';
select is(
  (select mentions from public.forum_threads where title = 'Prueba de menciones en el foro'),
  array['bbbbbbbb-0000-0000-0000-000000000004']::uuid[],
  'editar no reescribe las menciones'
);

-- ── Novedades desde la última visita ─────────────────────────
-- Para Ana el hilo no es novedad propia: lo movió Diego
select ok(public.forum_unread_count('aaaaaaaa-0000-0000-0000-000000000001') >= 1, 'la respuesta de otro cuenta como novedad');
insert into public.forum_reads (membership_id) values ('bbbbbbbb-0000-0000-0000-000000000003');
select is(public.forum_unread_count('aaaaaaaa-0000-0000-0000-000000000001'), 0, 'al ver el foro, no quedan novedades');

-- Para Diego, su propia respuesta no es novedad
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select is(
  (select count(*)::int from public.forum_threads t
   where t.title = 'Prueba de menciones en el foro' and t.last_author_id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  1,
  'la última actividad del hilo es de Diego'
);
select ok(
  not exists (
    select 1 from public.forum_reads where membership_id = 'bbbbbbbb-0000-0000-0000-000000000003'
  ),
  'nadie ve las visitas de otra persona'
);

select * from finish();
rollback;
