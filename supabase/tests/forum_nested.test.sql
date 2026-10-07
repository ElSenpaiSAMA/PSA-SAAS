-- Foro: respuestas anidadas (pgTAP). Arma su propio hilo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

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

select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
insert into public.forum_threads (id, author_id, category, title, body)
values ('77777777-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 'question', 'Hilo para respuestas anidadas', 'Pregunta');
insert into public.forum_threads (id, author_id, category, title, body)
values ('77777777-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', 'question', 'Otro hilo distinto', 'Otra pregunta');
insert into public.forum_posts (id, thread_id, author_id, body)
values ('77777777-1111-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 'Primera respuesta');

select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select lives_ok(
  $$ insert into public.forum_posts (id, thread_id, parent_id, author_id, body)
     values ('77777777-1111-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001', '77777777-1111-0000-0000-000000000001',
             'bbbbbbbb-0000-0000-0000-000000000004', 'Respuesta a la respuesta') $$,
  'se puede contestar una respuesta del mismo hilo'
);
select throws_ok(
  $$ insert into public.forum_posts (thread_id, parent_id, author_id, body)
     values ('77777777-0000-0000-0000-000000000002', '77777777-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 'Cruzada') $$,
  'parent post belongs to another thread',
  'no se puede colgar una respuesta de otro hilo'
);
select throws_ok(
  $$ update public.forum_posts set parent_id = null, body = 'cambio' where id = '77777777-1111-0000-0000-000000000002';
     update public.forum_posts set parent_id = '77777777-1111-0000-0000-000000000002' where id = '77777777-1111-0000-0000-000000000002' $$,
  'reply parent is immutable',
  'no se puede mover una respuesta a otra conversación'
);

-- Al borrar la madre, la respuesta queda directa al hilo (no se pierde)
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
delete from public.forum_posts where id = '77777777-1111-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claims', '', true);
select is(
  (select parent_id from public.forum_posts where id = '77777777-1111-0000-0000-000000000002'),
  null,
  'si se borra la respuesta madre, la hija queda como respuesta directa'
);
select is(
  (select reply_count from public.forum_threads where id = '77777777-0000-0000-0000-000000000001'),
  1,
  'el contador del hilo sigue bien'
);

select * from finish();
rollback;
