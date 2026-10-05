-- ============================================================
-- 0003_task_hours_aggregate.sql
-- Horas imputadas por tarea, agregadas.
-- RLS impide que un empleado vea los registros de tiempo de sus compañeros,
-- pero el progreso de un proyecto es información de equipo: esta función
-- expone solo totales por tarea, y solo a miembros de la organización.
-- ============================================================

create or replace function public.task_logged_minutes(p_org_id uuid)
returns table (task_id uuid, minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    te.task_id,
    sum(extract(epoch from (coalesce(te.ended_at, now()) - te.started_at)) / 60)::integer as minutes
  from public.time_entries te
  join public.tasks t on t.id = te.task_id
  where t.org_id = p_org_id
    and te.entry_type = 'task'
    and public.is_org_member(p_org_id)
  group by te.task_id;
$$;

revoke all on function public.task_logged_minutes(uuid) from public, anon;
grant execute on function public.task_logged_minutes(uuid) to authenticated;
