-- Departamentos y visibilidad de proyectos (pgTAP) sobre el seed demo.
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

-- IDs del seed
-- org: Diplonautic ...01 · departamentos: Dirección e..01, Taller e..02, Administración e..03
-- proyectos: Princess c..01 (Taller), Lagoon c..02 (Taller), Formación c..03 (Administración)
-- memberships: Laura b..01, Carlos b..02 (resp. Taller), Ana b..03, Diego b..04, Sofía b..05 (admin)

-- ── Estado inicial derivado de los departamentos ─────────────
select is(
  (select manager_id from public.memberships where id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
  'el responsable del departamento es el manager de sus miembros'
);

select is(
  (select department_id from public.memberships where id = 'bbbbbbbb-0000-0000-0000-000000000005'),
  'eeeeeeee-0000-0000-0000-000000000003'::uuid,
  'el responsable queda dentro de su departamento'
);

-- ── Empleada: solo proyectos donde es miembro ────────────────
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');

select results_eq(
  $$ select name from public.projects order by name $$,
  $$ values ('Climatización Princess V58'::text) $$,
  'una empleada solo ve los proyectos donde es miembro'
);

select is(
  (select count(*)::int from public.tasks where project_id = 'cccccccc-0000-0000-0000-000000000002'),
  0,
  'no ve tareas de proyectos ajenos'
);

select is(
  (select count(*)::int from public.task_logged_minutes('aaaaaaaa-0000-0000-0000-000000000001')
   where task_id in ('dddddddd-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000005',
                     'dddddddd-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-000000000007')),
  0,
  'las horas agregadas solo incluyen proyectos visibles'
);

select throws_ok(
  $$ insert into public.time_entries (membership_id, entry_type, task_id, started_at, ended_at)
     values ('bbbbbbbb-0000-0000-0000-000000000003', 'task', 'dddddddd-0000-0000-0000-000000000004',
             now() - interval '2 hours', now() - interval '1 hour') $$,
  'P0001',
  'not a member of this project',
  'no puede imputar horas a un proyecto del que no es miembro'
);

select throws_ok(
  $$ insert into public.project_members (project_id, membership_id)
     values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003') $$,
  '42501',
  null,
  'un empleado no puede sumarse a un proyecto'
);

select throws_ok(
  $$ insert into public.departments (org_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Ventas') $$,
  '42501',
  null,
  'un empleado no puede crear departamentos'
);

-- ── Responsable de departamento ──────────────────────────────
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');

select results_eq(
  $$ select name from public.projects where org_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by name $$,
  $$ values ('Climatización Princess V58'::text), ('Refit eléctrico Lagoon 46'::text) $$,
  'el responsable ve todos los proyectos de su departamento, y solo esos'
);

select lives_ok(
  $$ insert into public.project_members (project_id, membership_id)
     values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003') $$,
  'el responsable puede sumar miembros a proyectos de su departamento'
);

select lives_ok(
  $$ insert into public.projects (org_id, name, department_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'App móvil', 'eeeeeeee-0000-0000-0000-000000000002') $$,
  'el responsable puede crear proyectos en su departamento'
);

select throws_ok(
  $$ insert into public.projects (org_id, name, department_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Intrusión', 'eeeeeeee-0000-0000-0000-000000000003') $$,
  '42501',
  null,
  'el responsable no puede crear proyectos en otro departamento'
);

-- Ana ahora es miembro de "Refit eléctrico Lagoon 46"
select pg_temp.login_as('33333333-3333-3333-3333-333333333333', 'ana@demo.com');

select is(
  (select count(*)::int from public.projects),
  2,
  'al sumarla como miembro, la empleada pasa a ver el proyecto'
);

-- ── Admin ────────────────────────────────────────────────────
select pg_temp.login_as('55555555-5555-5555-5555-555555555555', 'sofia@demo.com');

select is(
  (select count(*)::int from public.projects where org_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  4,
  'una admin ve todos los proyectos de la organización'
);

select lives_ok(
  $$ update public.memberships set department_id = 'eeeeeeee-0000-0000-0000-000000000003'
     where id = 'bbbbbbbb-0000-0000-0000-000000000004' $$,
  'una admin puede mover a alguien de departamento'
);

select is(
  (select manager_id from public.memberships where id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  'bbbbbbbb-0000-0000-0000-000000000005'::uuid,
  'al cambiar de departamento, el manager pasa a ser el nuevo responsable'
);

select * from finish();
rollback;
