-- Mensajes de la web (pgTAP). Arma sus propios mensajes con un email propio.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

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

create or replace function pg_temp.as_system()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- La empresa de la web es Diplonautic (sin depender de lo que traiga la base)
update public.organizations set receives_web_contact = false where id <> 'aaaaaaaa-0000-0000-0000-000000000001';
update public.organizations set receives_web_contact = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';

create temp table t_ids (id uuid);
grant all on t_ids to anon, authenticated;

-- ── La web (anónima) envía un mensaje ─────────────────────────
select pg_temp.as_anon();
select lives_ok(
  $$ insert into t_ids select public.submit_contact_message('Cliente Pgtap', 'PGTAP-contact@example.com', '', 'Velero', 'Hallberg-Rassy 40',
       'Generadores', 'El generador no arranca después del invierno.') $$,
  'la web pública puede enviar un mensaje'
);
select throws_ok(
  $$ insert into public.contact_messages (org_id, name, email, boat_type, service, message)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Directo', 'x@example.com', 'Velero', 'Otro', 'Mensaje directo a la tabla') $$,
  '42501', null,
  'la web no escribe en la tabla directamente'
);
select is((select count(*)::int from public.contact_messages), 0, 'la web no puede leer los mensajes');

-- ── Se guarda normalizado en la empresa de la web ─────────────
select pg_temp.as_system();
select results_eq(
  $$ select org_id, email, phone from public.contact_messages where id = (select id from t_ids) $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'pgtap-contact@example.com'::text, null::text) $$,
  'se guarda en Diplonautic, con el email en minúsculas y sin teléfono vacío'
);
select is(
  (select count(*)::int from public.notifications
   where kind = 'contact.received' and entity_id = (select id from t_ids) and recipient_id = 'bbbbbbbb-0000-0000-0000-000000000005'),
  1,
  'la administradora recibe el aviso'
);
select is(
  (select count(*)::int from public.notifications
   where kind = 'contact.received' and entity_id = (select id from t_ids) and recipient_id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  0,
  'una empleada no recibe el aviso'
);

-- ── Solo lo gestiona quien tiene contact.manage ───────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select is((select count(*)::int from public.contact_messages), 0, 'una empleada no ve los mensajes de la web');
update public.contact_messages set status = 'closed' where id = (select id from t_ids);

select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select is(
  (select status from public.contact_messages where id = (select id from t_ids)),
  'new',
  'la empleada no pudo cambiar el estado; la administradora lo ve como nuevo'
);
update public.contact_messages set status = 'in_progress' where id = (select id from t_ids);
select is(
  (select handled_by from public.contact_messages where id = (select id from t_ids)),
  'bbbbbbbb-0000-0000-0000-000000000005'::uuid,
  'al cambiar el estado queda registrado quién lo gestiona'
);
select throws_ok(
  $$ update public.contact_messages set message = 'Mensaje cambiado por la empresa' where id = (select id from t_ids) $$,
  'only the status of a contact message can be changed',
  'el contenido del mensaje no se puede editar'
);
select throws_ok(
  $$ update public.organizations set receives_web_contact = false where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'receives_web_contact cannot be changed from the app',
  'un admin no cambia desde la app qué empresa recibe la web'
);

-- ── Freno a envíos repetidos ──────────────────────────────────
select pg_temp.as_anon();
select lives_ok(
  $$ select public.submit_contact_message('Cliente Pgtap', 'pgtap-contact@example.com', null, 'Velero', null, 'Otro', 'Segundo mensaje de prueba.');
     select public.submit_contact_message('Cliente Pgtap', 'pgtap-contact@example.com', null, 'Velero', null, 'Otro', 'Tercer mensaje de prueba.') $$,
  'se aceptan hasta tres mensajes por hora del mismo email'
);
select throws_ok(
  $$ select public.submit_contact_message('Cliente Pgtap', 'Pgtap-Contact@example.com', null, 'Velero', null, 'Otro', 'Cuarto mensaje de prueba.') $$,
  'too many contact messages',
  'el cuarto en la misma hora se rechaza'
);

select * from finish();
rollback;
