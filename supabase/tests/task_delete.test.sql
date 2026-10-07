-- Borrado de tareas (pgTAP) sobre el seed demo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

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

-- Una tarea nueva, sin horas, en un proyecto que gestiona Carlos (responsable del Taller)
insert into public.tasks (project_id, title)
select p.id, 'Tarea sin horas' from public.projects p
where p.org_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and p.department_id = 'eeeeeeee-0000-0000-0000-000000000002'
order by p.name limit 1;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'carlos@demo.com');

select throws_ok(
  $$ delete from public.tasks where id = (
       select t.id from public.tasks t
       where exists (select 1 from public.time_entries te where te.task_id = t.id and te.entry_type = 'task')
         and public.can_manage_project(t.project_id)
       limit 1) $$,
  'task has logged hours',
  'una tarea con horas imputadas no se puede borrar'
);
select lives_ok(
  $$ delete from public.tasks where title = 'Tarea sin horas' $$,
  'una tarea sin horas se borra'
);

reset role;
select is((select count(*)::int from public.tasks where title = 'Tarea sin horas'), 0, 'y desaparece');

select * from finish();
rollback;
