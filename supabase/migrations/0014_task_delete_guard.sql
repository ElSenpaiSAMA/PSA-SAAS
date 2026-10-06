-- ============================================================
-- 0014 · No se borran tareas con horas imputadas
--
-- Las horas de una tarea pueden estar ya facturadas en una OT. Borrar
-- la tarea dejaría esas horas huérfanas (o fallaría con un error
-- técnico por la restricción de time_entries). Una tarea con horas se
-- marca como hecha; solo se borran las que no tienen ninguna.
-- ============================================================

create or replace function public.guard_task_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.time_entries where task_id = old.id and entry_type = 'task'
  ) then
    raise exception 'task has logged hours';
  end if;
  return old;
end;
$$;

create trigger trg_tasks_guard_delete
  before delete on public.tasks
  for each row execute function public.guard_task_delete();
