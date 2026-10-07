-- ============================================================
-- 0026 · OT recurrentes por proyecto
--
-- Como en otros PSA (presupuestos recurrentes): un proyecto se marca como
-- mensual ("renovar la OT cada mes") y el día 1 se crea sola la OT del mes
-- nuevo, copiada de la del mes anterior (con sus tareas y su presupuesto), en
-- borrador, con un aviso a quien gestiona el proyecto para que la apruebe.
--
-- Antes la automatización "OT del mes" copiaba TODOS los proyectos o
-- ninguno (y venía apagada). Ahora la decide cada proyecto, así que viene
-- encendida: solo actúa sobre los proyectos marcados.
-- ============================================================

alter table public.projects add column recurring_work_orders boolean not null default false;

update public.automation_templates set default_enabled = true where key = 'work_orders.recurring';

-- Primer día del mes: cada proyecto activo MARCADO como recurrente, con OT el mes
-- pasado y ninguna este mes → se copia (en borrador)
create or replace function public.automation_work_orders_recurring(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', current_date)::date;
  v_prev date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_wo record;
  v_new uuid;
  v_title text;
  v_manager uuid;
  v_count int := 0;
begin
  for v_wo in
    select distinct on (w.project_id) w.*
    from public.work_orders w join public.projects p on p.id = w.project_id
    where w.org_id = p_org_id and p.status = 'active' and p.recurring_work_orders
      and w.period_start >= v_prev and w.period_start < v_month
      and not exists (
        select 1 from public.work_orders x
        where x.project_id = w.project_id and x.period_start >= v_month and x.period_start < v_month + interval '1 month'
      )
    order by w.project_id, w.number desc
  loop
    if not public.automation_mark(p_org_id, 'work_orders.recurring', v_wo.project_id || ':' || to_char(v_month, 'YYYY-MM'), 'project', v_wo.project_id, v_wo.title) then
      continue;
    end if;
    v_title := regexp_replace(v_wo.title, '\s·\s[^·]+\d{4}$', '') || ' · ' || public.month_label(v_month);
    v_new := public.copy_work_order(v_wo.id, v_title, v_month, (v_month + interval '1 month - 1 day')::date);
    for v_manager in select public.project_managers(v_wo.project_id) loop
      perform public.notify(p_org_id, v_manager, 'work_order.created', 'Nueva OT del mes en borrador',
        v_title || ' · revisala y aprobala para empezar a imputar horas',
        '/app/' || p_org_id || '/work-orders/' || v_new, 'work_order', v_new);
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
