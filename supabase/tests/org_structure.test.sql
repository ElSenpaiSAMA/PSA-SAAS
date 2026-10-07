-- Estructura de la empresa: niveles, ramas y rol en cada proyecto (pgTAP).
-- Usa las personas del seed (una por puesto) y arma los datos que necesita.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

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

create or replace function pg_temp.perms()
returns text[]
language sql
as $$ select array_agg(k order by k) from public.my_permissions('aaaaaaaa-0000-0000-0000-000000000001') k $$;

-- Personas (seed): Laura CEO · Jorge dir. técnico · Raúl dir. comercial · Sofía dir. Administración y RRHH
-- Carlos resp. Taller · Nuria resp. Oficina técnica · Irene resp. RRHH · Toni encargado · Ana, Diego, Pol, Iván equipo
-- Lucía aprendiz · Gestoría externa · dev superadmin

-- ── Lo que da cada nivel y cada rama ──────────────────────────
select pg_temp.login_as('11111111-1111-1111-1111-111111111111', 'laura@demo.com');
select ok('employees.manage' = any (pg_temp.perms()) and 'contact.manage' = any (pg_temp.perms()), 'la CEO tiene todos los permisos');

select pg_temp.login_as('10000000-0000-0000-0000-000000000002', 'jorge@demo.com');
select ok('tasks.manage_all' = any (pg_temp.perms()), 'el director técnico gestiona las tareas (función de su rama)');
select ok(not ('employees.manage' = any (pg_temp.perms())) and not ('people.sensitive' = any (pg_temp.perms())),
  'el director técnico no gestiona personas ni ve datos sensibles (no es su rama)');
select is((select count(*)::int from public.projects where org_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2,
  'el director técnico ve los proyectos de los departamentos de su rama (Taller), no los de Administración');
select ok(public.can_supervise('bbbbbbbb-0000-0000-0000-000000000003', 'time.view_team'),
  'el director técnico supervisa a una técnica de su rama');
select ok(not public.can_supervise('bbbbbbbb-0000-0000-0000-000000000109', 'time.view_team'),
  'pero no a un administrativo de otra rama');

select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select ok('employees.manage' = any (pg_temp.perms()) and 'people.sensitive' = any (pg_temp.perms()),
  'la directora de Administración y RRHH gestiona personas de toda la empresa');

select pg_temp.login_as('10000000-0000-0000-0000-000000000005', 'irene@demo.com');
select ok('employees.manage' = any (pg_temp.perms()), 'la responsable de RRHH recibe la función de su departamento');

select pg_temp.login_as('10000000-0000-0000-0000-000000000003', 'raul@demo.com');
select ok('contact.manage' = any (pg_temp.perms()) and not ('employees.manage' = any (pg_temp.perms())),
  'el director comercial gestiona los mensajes de la web, no las personas');

select pg_temp.login_as('10000000-0000-0000-0000-000000000004', 'nuria@demo.com');
select is((select count(*)::int from public.projects where org_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 3,
  'la oficina técnica ve todos los proyectos, también los de otros departamentos');
select ok('projects.manage' = any (pg_temp.perms()), 'la responsable de oficina técnica gestiona proyectos');

select pg_temp.login_as('10000000-0000-0000-0000-000000000006', 'toni@demo.com');
select ok(public.can_supervise('bbbbbbbb-0000-0000-0000-000000000108', 'time.view_team'),
  'el encargado supervisa a quien tiene a cargo (la aprendiz)');
select ok(not public.can_supervise('bbbbbbbb-0000-0000-0000-000000000003', 'time.view_team'),
  'pero no al resto del taller');

-- ── Equipo, aprendiz y externo: solo lo suyo ──────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select ok(not ('planning.view' = any (coalesce(pg_temp.perms(), '{}'))) and not ('people.view' = any (coalesce(pg_temp.perms(), '{}'))),
  'una técnica no ve planificación ni fichas');

select pg_temp.login_as('10000000-0000-0000-0000-000000000010', 'gestoria@demo.com');
select is((select count(*)::int from public.forum_threads), 0, 'un externo no ve el foro');
select is((select count(*)::int from public.memberships), 1, 'un externo no ve el directorio: solo a sí mismo');

-- ── Rol en el proyecto ────────────────────────────────────────
-- Diego es responsable del Lagoon: invita a quien necesite, pero no nombra responsables
select pg_temp.login_as('44444444-4444-4444-4444-444444444444', 'diego@demo.com');
select lives_ok(
  $$ insert into public.project_members (project_id, membership_id)
     values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000109') $$,
  'el responsable de un proyecto invita a cualquier persona de la empresa'
);
select is(
  (select added_by from public.project_members
   where project_id = 'cccccccc-0000-0000-0000-000000000002' and membership_id = 'bbbbbbbb-0000-0000-0000-000000000109'),
  'bbbbbbbb-0000-0000-0000-000000000004'::uuid,
  'queda registrado quién lo invitó'
);
select throws_ok(
  $$ insert into public.project_members (project_id, membership_id, role)
     values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000107', 'lead') $$,
  'only managers above the project can appoint a lead',
  'el responsable de un proyecto no nombra a otros responsables'
);
select throws_ok(
  $$ insert into public.project_members (project_id, membership_id)
     values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000109') $$,
  '42501', null,
  'no invita a un proyecto que no lleva'
);

-- Pol es observador del Princess: lo ve, pero no imputa horas
select pg_temp.login_as('10000000-0000-0000-0000-000000000007', 'pol@demo.com');
select is((select count(*)::int from public.projects), 1, 'un observador ve el proyecto que sigue (y ninguno más)');
select throws_ok(
  format($$ insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
            values ('bbbbbbbb-0000-0000-0000-000000000107', 'task', %L, now() - interval '2 hours', now() - interval '1 hour') $$,
    (select t.id from public.tasks t join public.work_orders w on w.id = t.work_order_id
     where t.project_id = 'cccccccc-0000-0000-0000-000000000001' and w.status = 'in_progress' limit 1)),
  'observers cannot log hours',
  'un observador no imputa horas'
);

-- Lucía (aprendiz) es miembro del Princess: solo imputa en tareas suyas
select pg_temp.login_as('10000000-0000-0000-0000-000000000008', 'lucia@demo.com');
select throws_ok(
  format($$ insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
            values ('bbbbbbbb-0000-0000-0000-000000000108', 'task', %L, now() - interval '2 hours', now() - interval '1 hour') $$,
    (select t.id from public.tasks t join public.work_orders w on w.id = t.work_order_id
     where t.project_id = 'cccccccc-0000-0000-0000-000000000001' and w.status = 'in_progress'
       and t.assigned_to is distinct from 'bbbbbbbb-0000-0000-0000-000000000108' limit 1)),
  'interns can only log hours on their own tasks',
  'una aprendiz no imputa en tareas que no tiene asignadas'
);

-- ── Calendario: vacaciones de mi departamento, no de otros ────
select pg_temp.as_system();
insert into public.vacation_requests (membership_id, start_date, end_date, status, reason) values
  ('bbbbbbbb-0000-0000-0000-000000000004', current_date + 300, current_date + 302, 'approved', 'cal-taller'),
  ('bbbbbbbb-0000-0000-0000-000000000109', current_date + 300, current_date + 302, 'approved', 'cal-admin');
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');
select ok(
  exists (select 1 from public.org_absences('aaaaaaaa-0000-0000-0000-000000000001', current_date + 300, current_date + 302)
          where membership_id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  'una técnica ve las vacaciones de su departamento'
);
select ok(
  not exists (select 1 from public.org_absences('aaaaaaaa-0000-0000-0000-000000000001', current_date + 300, current_date + 302)
              where membership_id = 'bbbbbbbb-0000-0000-0000-000000000109'),
  'pero no las de otros departamentos'
);

-- ── Rangos y superadmin ───────────────────────────────────────
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');
select throws_ok(
  $$ update public.memberships set role_id = 'director' where id = 'bbbbbbbb-0000-0000-0000-000000000106' $$,
  'insufficient rank for this change',
  'una directora no asigna un nivel igual al suyo'
);
select throws_ok(
  $$ update public.memberships set position = 'Hackeado' where id = 'bbbbbbbb-0000-0000-0000-000000000101' $$,
  'superadmin is managed by the platform',
  'nadie de la empresa toca al superadmin'
);

select * from finish();
rollback;
