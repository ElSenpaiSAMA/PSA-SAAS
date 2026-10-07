-- Perfil: qué se puede cambiar, fotos en la carpeta propia y avisos silenciados (pgTAP).
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

create or replace function pg_temp.as_system()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Qué se puede cambiar del propio perfil ────────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select lives_ok(
  $$ update public.profiles set full_name = 'Ana Torres Vidal' where id = '33333333-3333-3333-3333-333333333333' $$,
  'cada persona cambia su nombre'
);
select throws_ok(
  $$ update public.profiles set email = 'otra@demo.com' where id = '33333333-3333-3333-3333-333333333333' $$,
  'only name, photo and preferences can be changed',
  'el email no se cambia desde la app'
);
select throws_ok(
  $$ update public.profiles set avatar_url = 'https://tracker.example.com/foto.png' where id = '33333333-3333-3333-3333-333333333333' $$,
  'avatar must be uploaded to your own folder',
  'la foto no puede ser una URL externa'
);
select throws_ok(
  $$ update public.profiles
     set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/44444444-4444-4444-4444-444444444444/avatar.webp'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'avatar must be uploaded to your own folder',
  'la foto no puede ser la de otra persona'
);
select lives_ok(
  $$ update public.profiles
     set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/33333333-3333-3333-3333-333333333333/avatar.webp?v=1'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'la foto de su propia carpeta se acepta'
);
update public.profiles set full_name = 'Diego hackeado' where id = '44444444-4444-4444-4444-444444444444';
select is(
  (select full_name from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  'Diego Fernández',
  'nadie cambia el perfil de otra persona'
);

-- ── Fotos: cada persona escribe solo en su carpeta ────────────
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '33333333-3333-3333-3333-333333333333/avatar.webp') $$,
  'sube la foto a su carpeta'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', '44444444-4444-4444-4444-444444444444/avatar.webp') $$,
  '42501', null,
  'no puede subir a la carpeta de otra persona'
);

-- ── Avisos silenciados ────────────────────────────────────────
select throws_ok(
  $$ update public.profiles set muted_notifications = array['vacation.requested'] where id = '33333333-3333-3333-3333-333333333333' $$,
  '23514', null,
  'lo que pide una acción (aprobar vacaciones) no se puede silenciar'
);
update public.profiles set muted_notifications = array['forum.reply'] where id = '33333333-3333-3333-3333-333333333333';
insert into public.forum_threads (id, author_id, category, title, body)
values ('66666666-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 'question', 'Hilo para probar avisos silenciados', 'Pregunta');

select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
insert into public.forum_posts (thread_id, author_id, body)
values ('66666666-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 'Respuesta sin mención');
insert into public.forum_posts (thread_id, author_id, body, mentions)
values ('66666666-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', '@Ana Torres mirá esto',
        array['bbbbbbbb-0000-0000-0000-000000000003']::uuid[]);

select pg_temp.as_system();
select is(
  (select count(*)::int from public.notifications
   where recipient_id = 'bbbbbbbb-0000-0000-0000-000000000003' and kind = 'forum.reply'
     and link like '%66666666-0000-0000-0000-000000000001%'),
  0,
  'con las respuestas silenciadas, no le llega el aviso de respuesta'
);
select is(
  (select count(*)::int from public.notifications
   where recipient_id = 'bbbbbbbb-0000-0000-0000-000000000003' and kind = 'forum.mention'
     and link like '%66666666-0000-0000-0000-000000000001%'),
  1,
  'las menciones siguen llegando: se silencian por separado'
);
select is(
  (select muted_notifications from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  array['forum.reply']::text[],
  'la preferencia queda guardada en el perfil'
);

select * from finish();
rollback;
