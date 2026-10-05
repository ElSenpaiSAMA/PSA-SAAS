-- ============================================================
-- 0005_work_orders.sql
-- Órdenes de trabajo (OT) con período, presupuesto, tarifa y facturación.
-- Proyecto → OT → Tareas (con fechas). Planificación de carga en el tiempo.
--
-- Reglas:
--   * Solo se imputan horas a tareas de OT aprobadas o en curso.
--     La primera imputación pasa una OT aprobada a "en curso".
--   * Solo se factura una OT cerrada; una OT facturada queda bloqueada.
--   * Facturar y cambiar tarifas requiere billing.manage (owner/admin).
-- ============================================================

alter table public.projects
  add column hourly_rate numeric(10, 2) check (hourly_rate >= 0);

insert into public.permissions (key, description) values
  ('billing.manage', 'Definir tarifas y marcar órdenes de trabajo como facturadas');
insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'billing.manage'),
  ('admin', 'billing.manage');

-- ------------------------------------------------------------
-- work_orders
-- ------------------------------------------------------------
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  number integer not null,
  title text not null check (length(trim(title)) between 2 and 120),
  period_start date not null,
  period_end date not null,
  budgeted_hours numeric(10, 2) check (budgeted_hours >= 0),
  hourly_rate numeric(10, 2) check (hourly_rate >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'in_progress', 'closed')),
  billing_status text not null default 'unbilled'
    check (billing_status in ('unbilled', 'invoiced')),
  invoiced_at timestamptz,
  created_by uuid references public.memberships (id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (org_id, number)
);

create index work_orders_project_idx on public.work_orders (project_id);
create index work_orders_period_idx on public.work_orders (org_id, period_start, period_end);

create or replace function public.work_order_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where id = new.project_id;
  new.org_id := v_project.org_id;
  new.title := trim(new.title);
  new.hourly_rate := coalesce(new.hourly_rate, v_project.hourly_rate);
  -- Numeración correlativa por organización (OT-0001, OT-0002…)
  perform pg_advisory_xact_lock(hashtext('work_orders:' || new.org_id::text));
  select coalesce(max(number), 0) + 1 into new.number from public.work_orders where org_id = new.org_id;
  if auth.uid() is not null then
    new.created_by := public.my_membership_id(new.org_id);
    new.billing_status := 'unbilled';
    new.invoiced_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_work_orders_before_insert
  before insert on public.work_orders
  for each row execute function public.work_order_before_insert();

create or replace function public.guard_work_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id <> old.org_id or new.project_id <> old.project_id or new.number <> old.number then
    raise exception 'work order identity is immutable';
  end if;
  if auth.uid() is null then
    return new;
  end if;

  -- Una OT facturada no se toca (salvo revertir la facturación, que es de billing.manage)
  if old.billing_status = 'invoiced'
     and (new.title, new.period_start, new.period_end, new.budgeted_hours, new.hourly_rate, new.status)
         is distinct from (old.title, old.period_start, old.period_end, old.budgeted_hours, old.hourly_rate, old.status) then
    raise exception 'invoiced work orders are locked';
  end if;

  if (new.billing_status <> old.billing_status or new.hourly_rate is distinct from old.hourly_rate)
     and not public.has_permission(new.org_id, 'billing.manage') then
    raise exception 'billing changes require billing permission';
  end if;

  if new.billing_status = 'invoiced' and old.billing_status <> 'invoiced' then
    if new.status <> 'closed' then
      raise exception 'only closed work orders can be invoiced';
    end if;
    new.invoiced_at := now();
  elsif new.billing_status = 'unbilled' then
    new.invoiced_at := null;
  end if;

  return new;
end;
$$;

create trigger trg_work_orders_guard
  before update on public.work_orders
  for each row execute function public.guard_work_order_changes();

alter table public.work_orders enable row level security;

create policy "work_orders: select if project visible"
  on public.work_orders for select
  using (public.can_view_project(project_id));

create policy "work_orders: insert if can manage project"
  on public.work_orders for insert
  with check (public.can_manage_project(project_id));

create policy "work_orders: update if can manage project or billing"
  on public.work_orders for update
  using (public.can_manage_project(project_id) or public.has_permission(org_id, 'billing.manage'));

create policy "work_orders: delete drafts if can manage project"
  on public.work_orders for delete
  using (public.can_manage_project(project_id) and status = 'draft');

create trigger trg_audit_work_orders
  after insert or update or delete on public.work_orders
  for each row execute function audit.log_change();

-- ------------------------------------------------------------
-- tasks: dentro de una OT, con fechas
-- ------------------------------------------------------------
alter table public.tasks
  add column work_order_id uuid references public.work_orders (id) on delete cascade,
  add column start_date date,
  add column due_date date,
  add constraint tasks_valid_dates check (due_date is null or start_date is null or due_date >= start_date);

create index tasks_work_order_idx on public.tasks (work_order_id);
create index tasks_due_idx on public.tasks (due_date);

create or replace function public.tasks_sync_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La OT define el proyecto de la tarea
  if new.work_order_id is not null then
    select project_id into new.project_id from public.work_orders where id = new.work_order_id;
  end if;
  select org_id into new.org_id from public.projects where id = new.project_id;
  if new.assigned_to is not null then
    if public.membership_org(new.assigned_to) <> new.org_id then
      raise exception 'assignee must belong to the same organization';
    end if;
    insert into public.project_members (project_id, membership_id)
    values (new.project_id, new.assigned_to)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Las tareas de una OT facturada no se modifican
create or replace function public.guard_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if exists (
    select 1 from public.work_orders
    where id in (old.work_order_id, new.work_order_id) and billing_status = 'invoiced'
  ) then
    raise exception 'invoiced work orders are locked';
  end if;
  if not public.can_manage_project(new.project_id) then
    if new.title <> old.title
       or new.description is distinct from old.description
       or new.assigned_to is distinct from old.assigned_to
       or new.estimated_hours is distinct from old.estimated_hours
       or new.project_id <> old.project_id
       or new.work_order_id is distinct from old.work_order_id
       or new.start_date is distinct from old.start_date
       or new.due_date is distinct from old.due_date then
      raise exception 'only status can be changed on assigned tasks';
    end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- time_entries: solo en OT abiertas
-- ------------------------------------------------------------
create or replace function public.open_work_order_for_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wo public.work_orders;
begin
  select w.* into v_wo
  from public.tasks t join public.work_orders w on w.id = t.work_order_id
  where t.id = p_task_id;

  if not found then
    return; -- tarea sin OT (datos previos a 0005)
  end if;
  if v_wo.status not in ('approved', 'in_progress') then
    raise exception 'work order is not open for time entries';
  end if;
  if v_wo.status = 'approved' then
    update public.work_orders set status = 'in_progress' where id = v_wo.id;
  end if;
end;
$$;

create or replace function public.guard_time_entry_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.task_id is not null and (
    select org_id from public.tasks where id = new.task_id
  ) <> public.membership_org(new.membership_id) then
    raise exception 'task must belong to the same organization';
  end if;
  if new.task_id is not null and auth.uid() is not null then
    if not public.can_view_project((select project_id from public.tasks where id = new.task_id)) then
      raise exception 'not a member of this project';
    end if;
    perform public.open_work_order_for_task(new.task_id);
  end if;
  if new.entry_type = 'clock' and auth.uid() is not null then
    new.started_at := now();
    new.ended_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.guard_time_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.membership_id <> old.membership_id or new.entry_type <> old.entry_type then
    raise exception 'membership and entry type are immutable';
  end if;
  if old.entry_type = 'clock' then
    if new.started_at <> old.started_at then
      raise exception 'clock-in time cannot be modified';
    end if;
    if old.ended_at is not null and new.ended_at is distinct from old.ended_at then
      raise exception 'closed clock entries cannot be modified';
    end if;
  end if;
  if new.task_id is not null and (
    select org_id from public.tasks where id = new.task_id
  ) <> public.membership_org(new.membership_id) then
    raise exception 'task must belong to the same organization';
  end if;
  if old.entry_type = 'task' then
    perform public.open_work_order_for_task(old.task_id);
    if new.task_id is distinct from old.task_id then
      perform public.open_work_order_for_task(new.task_id);
    end if;
  end if;
  return new;
end;
$$;

-- Borrar horas de una OT cerrada/facturada tampoco
create or replace function public.guard_time_entry_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.entry_type = 'task' and old.task_id is not null then
    perform public.open_work_order_for_task(old.task_id);
  end if;
  return old;
end;
$$;

create trigger trg_time_entries_guard_delete
  before delete on public.time_entries
  for each row execute function public.guard_time_entry_delete();

-- ------------------------------------------------------------
-- Duplicar una OT a otro período ("copiar del mes anterior")
-- ------------------------------------------------------------
create or replace function public.duplicate_work_order(
  p_work_order_id uuid,
  p_title text,
  p_period_start date,
  p_period_end date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.work_orders;
  v_new_id uuid;
  v_shift integer;
begin
  select * into v_src from public.work_orders where id = p_work_order_id;
  if not found or not public.can_manage_project(v_src.project_id) then
    raise exception 'work order not found';
  end if;
  if p_period_end < p_period_start then
    raise exception 'invalid period';
  end if;

  insert into public.work_orders (project_id, title, period_start, period_end, budgeted_hours, hourly_rate, status)
  values (v_src.project_id, coalesce(nullif(trim(p_title), ''), v_src.title), p_period_start, p_period_end,
          v_src.budgeted_hours, v_src.hourly_rate, 'draft')
  returning id into v_new_id;

  -- Las fechas de las tareas se corren lo mismo que el período
  v_shift := p_period_start - v_src.period_start;

  insert into public.tasks (project_id, work_order_id, title, description, assigned_to, estimated_hours, status, start_date, due_date)
  select t.project_id, v_new_id, t.title, t.description,
         case when exists (select 1 from public.memberships m where m.id = t.assigned_to and m.status = 'active')
              then t.assigned_to end,
         t.estimated_hours, 'todo',
         least(greatest(t.start_date + v_shift, p_period_start), p_period_end),
         least(greatest(t.due_date + v_shift, p_period_start), p_period_end)
  from public.tasks t
  where t.work_order_id = p_work_order_id
  order by t.created_at;

  return v_new_id;
end;
$$;

-- ------------------------------------------------------------
-- Planificación: tareas abiertas con fechas, por persona, en un rango.
-- Solo de uno mismo o de quien el usuario supervisa (no expone títulos).
-- ------------------------------------------------------------
create or replace function public.workload_items(p_org_id uuid, p_from date, p_to date)
returns table (
  membership_id uuid,
  task_id uuid,
  estimated_hours numeric,
  start_date date,
  due_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.assigned_to,
    t.id,
    t.estimated_hours,
    coalesce(t.start_date, w.period_start, t.created_at::date),
    coalesce(t.due_date, w.period_end, t.created_at::date)
  from public.tasks t
  left join public.work_orders w on w.id = t.work_order_id
  where t.org_id = p_org_id
    and t.assigned_to is not null
    and t.status <> 'done'
    and coalesce(t.estimated_hours, 0) > 0
    and coalesce(t.start_date, w.period_start, t.created_at::date) <= p_to
    and coalesce(t.due_date, w.period_end, t.created_at::date) >= p_from
    and public.is_org_member(p_org_id)
    and (
      public.is_own_membership(t.assigned_to)
      or public.can_supervise(t.assigned_to, 'time.view_team')
    );
$$;

-- ------------------------------------------------------------
-- Datos existentes: una OT "en curso" del mes actual por proyecto con tareas sueltas
-- ------------------------------------------------------------
do $$
declare
  v_project record;
  v_wo uuid;
begin
  for v_project in
    select distinct p.id, p.name, p.budgeted_hours, p.hourly_rate
    from public.projects p join public.tasks t on t.project_id = p.id
    where t.work_order_id is null
  loop
    insert into public.work_orders (project_id, title, period_start, period_end, budgeted_hours, hourly_rate, status)
    values (
      v_project.id,
      v_project.name || ' · período inicial',
      date_trunc('month', current_date)::date,
      (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
      v_project.budgeted_hours,
      v_project.hourly_rate,
      'in_progress'
    )
    returning id into v_wo;

    update public.tasks set work_order_id = v_wo where project_id = v_project.id and work_order_id is null;
  end loop;
end;
$$;
