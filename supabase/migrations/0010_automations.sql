-- ============================================================
-- 0010 · Motor de automatizaciones
--
-- Reglas "cuando pasa X → si se cumple Y → hacer Z", configurables
-- por empresa (activar/desactivar + parámetros). Dos tipos:
--   · de evento: corren en un trigger cuando pasa algo (p. ej. una
--     solicitud de vacaciones o una imputación de horas);
--   · programadas: las corre run_automations() cada 15 minutos
--     (pg_cron) o a demanda con "Ejecutar ahora".
--
-- Cada acción queda en automation_runs con una clave de
-- deduplicación: correr una regla dos veces no repite avisos ni
-- acciones. Todo lo que cambia datos pasa además por audit_log.
--
-- Mientras una automatización actúa se activa el flag de sesión
-- app.automation: los guards que protegen decisiones humanas (p. ej.
-- "no podés aprobar tus propias vacaciones") lo reconocen, y las
-- notificaciones salen sin "actor" (las envía el sistema).
-- ============================================================

insert into public.permissions (key, description) values
  ('automations.manage', 'Configurar las automatizaciones de la empresa');
insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'automations.manage'),
  ('admin', 'automations.manage');

-- ------------------------------------------------------------
-- Catálogo, configuración por empresa e historial
-- ------------------------------------------------------------
create table public.automation_templates (
  key text primary key,
  trigger_kind text not null check (trigger_kind in ('event', 'schedule')),
  default_enabled boolean not null,
  default_params jsonb not null default '{}'::jsonb
);

alter table public.automation_templates enable row level security;
create policy "automation_templates: readable" on public.automation_templates for select using (auth.uid() is not null);

insert into public.automation_templates (key, trigger_kind, default_enabled, default_params) values
  ('vacations.auto_approve_short', 'event',    false, '{"max_days": 1, "min_notice_days": 2}'),
  ('vacations.escalate_stale',     'schedule', true,  '{"after_days": 3}'),
  ('time.auto_close_clock',        'schedule', true,  '{"max_hours": 12}'),
  ('time.clock_out_reminder',      'schedule', true,  '{"hour": 19, "timezone": "Europe/Madrid"}'),
  ('work_orders.budget_alert',     'event',    true,  '{"thresholds": [80, 100]}'),
  ('work_orders.auto_close',       'schedule', false, '{"grace_days": 3}'),
  ('work_orders.recurring',        'schedule', false, '{}'),
  ('tasks.due_reminder',           'schedule', true,  '{"days_before": 1, "hour": 8, "timezone": "Europe/Madrid"}'),
  ('team.weekly_summary',          'schedule', true,  '{"hour": 8, "timezone": "Europe/Madrid"}');

create table public.automation_rules (
  org_id uuid not null references public.organizations (id) on delete cascade,
  key text not null references public.automation_templates (key) on delete cascade,
  enabled boolean not null,
  params jsonb not null default '{}'::jsonb,
  updated_by uuid references public.memberships (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

alter table public.automation_rules enable row level security;

create policy "automation_rules: select with automations.manage"
  on public.automation_rules for select using (public.has_permission(org_id, 'automations.manage'));
create policy "automation_rules: insert with automations.manage"
  on public.automation_rules for insert with check (public.has_permission(org_id, 'automations.manage'));
create policy "automation_rules: update with automations.manage"
  on public.automation_rules for update
  using (public.has_permission(org_id, 'automations.manage'))
  with check (public.has_permission(org_id, 'automations.manage'));

create or replace function public.touch_automation_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := public.my_membership_id(new.org_id);
  return new;
end;
$$;

create trigger trg_automation_rules_touch
  before insert or update on public.automation_rules
  for each row execute function public.touch_automation_rule();

create trigger trg_audit_automation_rules
  after insert or update or delete on public.automation_rules
  for each row execute function audit.log_change();

create table public.automation_runs (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  rule_key text not null,
  dedupe_key text not null,
  entity_type text,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now(),
  unique (org_id, rule_key, dedupe_key)
);

create index automation_runs_org_idx on public.automation_runs (org_id, created_at desc);

alter table public.automation_runs enable row level security;
create policy "automation_runs: select with automations.manage"
  on public.automation_runs for select using (public.has_permission(org_id, 'automations.manage'));

-- ------------------------------------------------------------
-- Helpers del motor
-- ------------------------------------------------------------

-- Configuración efectiva: la de la empresa, o la del catálogo por defecto
create or replace function public.automation_config(p_org_id uuid, p_key text, out enabled boolean, out params jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(r.enabled, t.default_enabled), t.default_params || coalesce(r.params, '{}'::jsonb)
  from public.automation_templates t
  left join public.automation_rules r on r.key = t.key and r.org_id = p_org_id
  where t.key = p_key;
$$;

-- Registra una acción. Devuelve false si ya se había hecho (deduplicación).
create or replace function public.automation_mark(
  p_org_id uuid, p_key text, p_dedupe text, p_entity_type text, p_entity_id uuid, p_detail text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.automation_runs (org_id, rule_key, dedupe_key, entity_type, entity_id, detail)
  values (p_org_id, p_key, p_dedupe, p_entity_type, p_entity_id, p_detail)
  on conflict do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.automation_begin()
returns void
language sql
as $$ select set_config('app.automation', 'on', true); $$;

create or replace function public.in_automation()
returns boolean
language sql
stable
as $$ select coalesce(current_setting('app.automation', true), '') = 'on'; $$;

-- Hora local de la empresa (configurable por regla; por defecto Madrid)
create or replace function public.local_now(p_params jsonb)
returns timestamp
language sql
stable
as $$ select now() at time zone coalesce(p_params ->> 'timezone', 'Europe/Madrid'); $$;

-- Quienes gestionan un proyecto: responsable de su departamento + projects.manage
create or replace function public.project_managers(p_project_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.head_id
  from public.projects p join public.departments d on d.id = p.department_id
  where p.id = p_project_id and d.head_id is not null
  union
  select m.id
  from public.projects p join public.memberships m on m.org_id = p.org_id
  where p.id = p_project_id and m.status = 'active' and public.membership_can(m.id, 'projects.manage');
$$;

-- notify(): durante una automatización el aviso lo manda el sistema (sin actor),
-- así también le llega a quien originó el evento.
create or replace function public.notify(
  p_org_id uuid,
  p_recipient_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := case when public.in_automation() then null else public.my_membership_id(p_org_id) end;
begin
  if p_recipient_id is null or p_recipient_id = v_actor then
    return;
  end if;
  insert into public.notifications (org_id, recipient_id, actor_id, kind, title, body, link, entity_type, entity_id)
  values (p_org_id, p_recipient_id, v_actor, p_kind, p_title, p_body, p_link, p_entity_type, p_entity_id);
end;
$$;

revoke execute on function public.notify(uuid, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

-- Guard de vacaciones: una automatización puede decidir (nunca el propio solicitante)
create or replace function public.guard_vacation_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean := public.is_own_membership(old.membership_id);
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.membership_id <> old.membership_id
     or new.start_date <> old.start_date
     or new.end_date <> old.end_date then
    raise exception 'request dates and owner are immutable';
  end if;
  if old.status <> 'pending' then
    raise exception 'only pending requests can change';
  end if;

  if public.in_automation() and new.status in ('approved', 'rejected') then
    new.decided_by := null;
    new.decided_at := now();
  elsif v_is_owner then
    if new.status not in ('pending', 'cancelled') then
      raise exception 'you cannot decide on your own request';
    end if;
  elsif new.status in ('approved', 'rejected') then
    new.decided_by := public.my_membership_id(public.membership_org(old.membership_id));
    new.decided_at := now();
  else
    raise exception 'invalid status transition';
  end if;
  return new;
end;
$$;

-- Avisos de vacaciones: si una automatización ya la aprobó al crearse, no se pide aprobación a nadie
create or replace function public.notify_vacation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.membership_org(new.membership_id);
  v_who text := public.member_name(new.membership_id);
  v_range text := public.fmt_range(new.start_date, new.end_date);
  v_approver uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending'
     and (select status from public.vacation_requests where id = new.id) = 'pending' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(v_org, v_approver, 'vacation.requested',
        v_who || ' pidió vacaciones', v_range || ' · pendiente de tu aprobación', '/app/' || v_org || '/inbox', 'vacation_request', new.id);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify(v_org, new.membership_id, 'vacation.decided',
      case when new.status = 'approved' then 'Tus vacaciones fueron aprobadas' else 'Tus vacaciones fueron rechazadas' end,
      v_range || coalesce(' · ' || public.member_name(new.decided_by), ' · aprobación automática'),
      '/app/' || v_org || '/vacations', 'vacation_request', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'cancelled' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(v_org, v_approver, 'vacation.cancelled',
        v_who || ' canceló su solicitud', v_range, '/app/' || v_org || '/vacations', 'vacation_request', new.id);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.month_label(p_date date)
returns text
language sql
immutable
as $$
  select (array['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
                'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'])[extract(month from p_date)::int]
         || ' ' || extract(year from p_date)::int;
$$;

-- Asignación de tareas: no se avisa por las tareas copiadas en bloque a una OT nueva
-- (nacen en borrador; avisar una por una sería ruido).
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.membership_org(new.assigned_to);
begin
  if coalesce(current_setting('app.silent_copy', true), '') = 'on' then
    return new;
  end if;
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(v_org, new.assigned_to, 'task.assigned',
      'Te asignaron una tarea', new.title || coalesce(' · ' || (select name from public.projects where id = new.project_id), ''),
      '/app/' || v_org || '/projects/' || new.project_id, 'task', new.id);
  end if;
  return new;
end;
$$;

-- Copia interna de una OT con sus tareas (sin chequeo de permisos: la usan
-- duplicate_work_order, que sí los chequea, y las automatizaciones).
create or replace function public.copy_work_order(p_work_order_id uuid, p_title text, p_period_start date, p_period_end date)
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
  if not found then
    raise exception 'work order not found';
  end if;
  if p_period_end < p_period_start then
    raise exception 'invalid period';
  end if;

  insert into public.work_orders (project_id, title, period_start, period_end, budgeted_hours, hourly_rate, status)
  values (v_src.project_id, coalesce(nullif(trim(p_title), ''), v_src.title), p_period_start, p_period_end,
          v_src.budgeted_hours, v_src.hourly_rate, 'draft')
  returning id into v_new_id;

  v_shift := p_period_start - v_src.period_start;

  perform set_config('app.silent_copy', 'on', true);
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
  perform set_config('app.silent_copy', '', true);

  return v_new_id;
end;
$$;

revoke execute on function public.copy_work_order(uuid, text, date, date) from public, anon, authenticated;

create or replace function public.duplicate_work_order(p_work_order_id uuid, p_title text, p_period_start date, p_period_end date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_project((select project_id from public.work_orders where id = p_work_order_id)) then
    raise exception 'work order not found';
  end if;
  return public.copy_work_order(p_work_order_id, p_title, p_period_start, p_period_end);
end;
$$;

-- ============================================================
-- Reglas de evento
-- ============================================================

-- Vacaciones cortas con aviso suficiente y sin choque en el departamento → aprobadas solas
create or replace function public.automation_vacation_auto_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.membership_org(new.membership_id);
  v_cfg record := public.automation_config(v_org, 'vacations.auto_approve_short');
  v_dept uuid := (select department_id from public.memberships where id = new.membership_id);
begin
  if new.status <> 'pending' or not v_cfg.enabled then
    return null;
  end if;
  if public.business_days(new.start_date, new.end_date, v_org) > (v_cfg.params ->> 'max_days')::int
     or new.start_date - current_date < (v_cfg.params ->> 'min_notice_days')::int then
    return null;
  end if;
  -- Nadie más de su departamento ausente esos días (aprobado o pendiente)
  if v_dept is not null and exists (
    select 1 from public.vacation_requests v
    join public.memberships m on m.id = v.membership_id
    where m.department_id = v_dept and v.membership_id <> new.membership_id
      and v.status in ('approved', 'pending')
      and v.start_date <= new.end_date and v.end_date >= new.start_date
  ) then
    return null;
  end if;

  perform public.automation_begin();
  update public.vacation_requests set status = 'approved' where id = new.id;
  perform public.automation_mark(v_org, 'vacations.auto_approve_short', new.id::text, 'vacation_request', new.id,
    public.member_name(new.membership_id) || ' · ' || public.fmt_range(new.start_date, new.end_date));
  perform set_config('app.automation', '', true);
  return null;
end;
$$;

-- "trg_a…" corre antes que "trg_notify…" (los AFTER triggers van por orden alfabético)
create trigger trg_automation_vacations
  after insert on public.vacation_requests
  for each row execute function public.automation_vacation_auto_approve();

-- Horas imputadas a una OT que cruzan un umbral de su presupuesto → aviso a quienes la gestionan
create or replace function public.automation_work_order_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wo public.work_orders;
  v_cfg record;
  v_logged numeric;
  v_pct numeric;
  v_threshold int;
  v_manager uuid;
begin
  if new.entry_type <> 'task' or new.task_id is null then
    return null;
  end if;
  select w.* into v_wo from public.work_orders w join public.tasks t on t.work_order_id = w.id where t.id = new.task_id;
  if not found or coalesce(v_wo.budgeted_hours, 0) <= 0 then
    return null;
  end if;
  v_cfg := public.automation_config(v_wo.org_id, 'work_orders.budget_alert');
  if not v_cfg.enabled then
    return null;
  end if;

  select coalesce(sum(extract(epoch from (te.ended_at - te.started_at)) / 3600), 0) into v_logged
  from public.time_entries te join public.tasks t on t.id = te.task_id
  where t.work_order_id = v_wo.id and te.entry_type = 'task' and te.ended_at is not null;
  v_pct := v_logged / v_wo.budgeted_hours * 100;

  for v_threshold in select (jsonb_array_elements_text(v_cfg.params -> 'thresholds'))::int order by 1 desc loop
    if v_pct >= v_threshold then
      if public.automation_mark(v_wo.org_id, 'work_orders.budget_alert', v_wo.id || ':' || v_threshold, 'work_order', v_wo.id,
           v_wo.title || ' · ' || round(v_pct) || ' % del presupuesto') then
        perform public.automation_begin();
        for v_manager in select public.project_managers(v_wo.project_id) loop
          perform public.notify(v_wo.org_id, v_manager, 'work_order.budget',
            case when v_threshold >= 100 then 'OT sin presupuesto de horas' else 'OT al ' || v_threshold || ' % del presupuesto' end,
            v_wo.title || ' · ' || round(v_logged, 1) || ' h de ' || v_wo.budgeted_hours || ' h',
            '/app/' || v_wo.org_id || '/work-orders/' || v_wo.id, 'work_order', v_wo.id);
        end loop;
        perform set_config('app.automation', '', true);
      end if;
      exit; -- solo el umbral más alto alcanzado en esta imputación
    end if;
  end loop;
  return null;
end;
$$;

create trigger trg_automation_time_entries
  after insert or update of ended_at on public.time_entries
  for each row execute function public.automation_work_order_budget();

-- ============================================================
-- Reglas programadas. Cada una recibe la empresa, sus parámetros y
-- p_force (true = "Ejecutar ahora": ignora la ventana horaria).
-- Devuelven cuántas acciones hicieron.
-- ============================================================

-- Solicitudes sin respuesta hace N días → aviso a quien está por encima del aprobador (o administración)
create or replace function public.automation_vacations_escalate(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_approver uuid;
  v_target uuid;
  v_count int := 0;
begin
  for v_req in
    select v.* from public.vacation_requests v
    where public.membership_org(v.membership_id) = p_org_id and v.status = 'pending'
      and v.created_at < now() - make_interval(days => (p_params ->> 'after_days')::int)
  loop
    if not public.automation_mark(p_org_id, 'vacations.escalate_stale', v_req.id::text, 'vacation_request', v_req.id,
         public.member_name(v_req.membership_id) || ' · ' || public.fmt_range(v_req.start_date, v_req.end_date)) then
      continue;
    end if;
    for v_approver in select public.vacation_approvers(v_req.membership_id) loop
      for v_target in
        select x from public.vacation_approvers(v_approver) x
        union
        select m.id from public.memberships m
        where m.org_id = p_org_id and m.status = 'active' and public.membership_can(m.id, 'employees.manage')
      loop
        if v_target <> v_req.membership_id then
          perform public.notify(p_org_id, v_target, 'vacation.escalated',
            'Solicitud sin respuesta hace ' || (p_params ->> 'after_days') || ' días',
            public.member_name(v_req.membership_id) || ' · ' || public.fmt_range(v_req.start_date, v_req.end_date)
              || ' · la tiene ' || public.member_name(v_approver),
            '/app/' || p_org_id || '/vacations', 'vacation_request', v_req.id);
        end if;
      end loop;
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Fichajes abiertos hace más de N horas → se cierran en el límite y se avisa a la persona
create or replace function public.automation_time_auto_close(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_hours int := (p_params ->> 'max_hours')::int;
  v_count int := 0;
begin
  for v_entry in
    select te.* from public.time_entries te
    where public.membership_org(te.membership_id) = p_org_id
      and te.entry_type in ('clock', 'break') and te.ended_at is null
      and te.started_at < now() - make_interval(hours => v_hours)
  loop
    update public.time_entries set ended_at = v_entry.started_at + make_interval(hours => v_hours) where id = v_entry.id;
    perform public.automation_mark(p_org_id, 'time.auto_close_clock', v_entry.id::text, 'time_entry', v_entry.id,
      public.member_name(v_entry.membership_id) || ' · abierto desde ' || to_char(v_entry.started_at at time zone 'Europe/Madrid', 'DD/MM HH24:MI'));
    perform public.notify(p_org_id, v_entry.membership_id, 'clock.auto_closed',
      'Cerramos un fichaje que quedó abierto',
      'Lo abriste el ' || to_char(v_entry.started_at at time zone 'Europe/Madrid', 'DD/MM a las HH24:MI') || ' y lo cerramos a las ' || v_hours || ' h. Revisá que esté bien.',
      '/app/' || p_org_id || '/time-tracking', 'time_entry', v_entry.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- A partir de cierta hora, recordatorio a quien sigue fichado (una vez por jornada)
create or replace function public.automation_time_reminder(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_count int := 0;
begin
  if not p_force and extract(hour from public.local_now(p_params)) < (p_params ->> 'hour')::int then
    return 0;
  end if;
  for v_entry in
    select te.* from public.time_entries te
    where public.membership_org(te.membership_id) = p_org_id
      and te.entry_type = 'clock' and te.ended_at is null
  loop
    if public.automation_mark(p_org_id, 'time.clock_out_reminder', v_entry.id::text, 'time_entry', v_entry.id, public.member_name(v_entry.membership_id)) then
      perform public.notify(p_org_id, v_entry.membership_id, 'clock.reminder',
        '¿Te olvidaste de fichar la salida?',
        'Seguís fichado desde las ' || to_char(v_entry.started_at at time zone coalesce(p_params ->> 'timezone', 'Europe/Madrid'), 'HH24:MI'),
        '/app/' || p_org_id || '/time-tracking', 'time_entry', v_entry.id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- OT cuyo período terminó hace N días y siguen abiertas → se cierran (y facturación recibe su aviso)
create or replace function public.automation_work_orders_close(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wo record;
  v_manager uuid;
  v_count int := 0;
begin
  for v_wo in
    select w.* from public.work_orders w
    where w.org_id = p_org_id and w.status in ('approved', 'in_progress') and w.billing_status = 'unbilled'
      and w.period_end + (p_params ->> 'grace_days')::int < current_date
  loop
    update public.work_orders set status = 'closed' where id = v_wo.id;
    perform public.automation_mark(p_org_id, 'work_orders.auto_close', v_wo.id::text, 'work_order', v_wo.id, v_wo.title);
    for v_manager in select public.project_managers(v_wo.project_id) loop
      perform public.notify(p_org_id, v_manager, 'work_order.auto_closed', 'OT cerrada automáticamente',
        v_wo.title || ' · el período terminó el ' || to_char(v_wo.period_end, 'DD/MM'),
        '/app/' || p_org_id || '/work-orders/' || v_wo.id, 'work_order', v_wo.id);
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Primer día del mes: cada proyecto activo con OT el mes pasado y ninguna este mes → se copia (en borrador)
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
    where w.org_id = p_org_id and p.status = 'active'
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

-- Tareas que vencen pronto o ya vencieron → aviso a la persona asignada (una vez por tarea y fecha)
create or replace function public.automation_tasks_due(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_count int := 0;
  v_soon date := current_date + (p_params ->> 'days_before')::int;
begin
  if not p_force and extract(hour from public.local_now(p_params)) < (p_params ->> 'hour')::int then
    return 0;
  end if;
  for v_task in
    select t.*, p.name as project_name from public.tasks t join public.projects p on p.id = t.project_id
    where t.org_id = p_org_id and t.status <> 'done' and t.assigned_to is not null and t.due_date is not null
      and (t.due_date = v_soon or t.due_date < current_date)
  loop
    if public.automation_mark(p_org_id, 'tasks.due_reminder', v_task.id || ':' || v_task.due_date || ':' || (v_task.due_date < current_date),
         'task', v_task.id, v_task.title) then
      perform public.notify(p_org_id, v_task.assigned_to,
        case when v_task.due_date < current_date then 'task.overdue' else 'task.due_soon' end,
        case when v_task.due_date < current_date then 'Tarea vencida' else 'Tarea por vencer' end,
        v_task.title || ' · ' || v_task.project_name || ' · vence el ' || to_char(v_task.due_date, 'DD/MM'),
        '/app/' || p_org_id || '/projects/' || v_task.project_id, 'task', v_task.id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Lunes a la mañana: resumen de la semana anterior para quien tiene equipo a cargo
create or replace function public.automation_weekly_summary(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := (date_trunc('week', current_date) - interval '1 week')::date;
  v_lead record;
  v_minutes numeric;
  v_pending int;
  v_overdue int;
  v_count int := 0;
begin
  if not p_force and (extract(isodow from public.local_now(p_params)) <> 1 or extract(hour from public.local_now(p_params)) < (p_params ->> 'hour')::int) then
    return 0;
  end if;
  for v_lead in
    select distinct m.id from public.memberships m
    where m.org_id = p_org_id and m.status = 'active'
      and exists (select 1 from public.memberships r where r.manager_id = m.id and r.status = 'active')
  loop
    if not public.automation_mark(p_org_id, 'team.weekly_summary', v_lead.id || ':' || v_week_start, 'membership', v_lead.id, public.member_name(v_lead.id)) then
      continue;
    end if;
    select coalesce(sum(extract(epoch from (coalesce(te.ended_at, now()) - te.started_at)) / 60), 0) into v_minutes
    from public.time_entries te
    where te.entry_type = 'clock' and public.is_in_reporting_line(v_lead.id, te.membership_id)
      and te.started_at >= v_week_start and te.started_at < v_week_start + 7;
    select count(*) into v_pending from public.vacation_requests v
    where v.status = 'pending' and public.is_in_reporting_line(v_lead.id, v.membership_id);
    select count(*) into v_overdue from public.tasks t
    where t.status <> 'done' and t.due_date < current_date and t.assigned_to is not null
      and public.is_in_reporting_line(v_lead.id, t.assigned_to);
    perform public.notify(p_org_id, v_lead.id, 'team.weekly_summary', 'Resumen de tu equipo · semana del ' || to_char(v_week_start, 'DD/MM'),
      round(v_minutes / 60) || ' h fichadas · ' || v_pending || ' vacaciones por aprobar · ' || v_overdue || ' tareas vencidas',
      '/app/' || p_org_id || '/time-tracking', 'membership', v_lead.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Ejecución
-- ------------------------------------------------------------
create or replace function public.automation_dispatch(p_org_id uuid, p_key text, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.automation_begin();
  return case p_key
    when 'vacations.escalate_stale' then public.automation_vacations_escalate(p_org_id, p_params, p_force)
    when 'time.auto_close_clock'    then public.automation_time_auto_close(p_org_id, p_params, p_force)
    when 'time.clock_out_reminder'  then public.automation_time_reminder(p_org_id, p_params, p_force)
    when 'work_orders.auto_close'   then public.automation_work_orders_close(p_org_id, p_params, p_force)
    when 'work_orders.recurring'    then public.automation_work_orders_recurring(p_org_id, p_params, p_force)
    when 'tasks.due_reminder'       then public.automation_tasks_due(p_org_id, p_params, p_force)
    when 'team.weekly_summary'      then public.automation_weekly_summary(p_org_id, p_params, p_force)
    else 0
  end;
end;
$$;

-- Lo llama pg_cron cada 15 minutos: todas las reglas programadas activas de todas las empresas
create or replace function public.run_automations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_tpl record;
  v_cfg record;
  v_total int := 0;
begin
  for v_org in select id from public.organizations loop
    for v_tpl in select key from public.automation_templates where trigger_kind = 'schedule' loop
      v_cfg := public.automation_config(v_org, v_tpl.key);
      if v_cfg.enabled then
        begin
          v_total := v_total + public.automation_dispatch(v_org, v_tpl.key, v_cfg.params, false);
        exception when others then
          -- Una regla que falla no frena a las demás; queda registrada
          perform public.automation_mark(v_org, v_tpl.key, 'error:' || now(), null, null, sqlerrm);
        end;
      end if;
    end loop;
  end loop;
  perform set_config('app.automation', '', true);
  return v_total;
end;
$$;

revoke execute on function public.run_automations() from public, anon, authenticated;
revoke execute on function public.automation_dispatch(uuid, text, jsonb, boolean) from public, anon, authenticated;

-- "Ejecutar ahora" desde la app (solo automations.manage). Ignora la ventana horaria, no el estado activo.
create or replace function public.run_automation_now(p_org_id uuid, p_key text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record := public.automation_config(p_org_id, p_key);
  v_result int;
begin
  if not public.has_permission(p_org_id, 'automations.manage') then
    raise exception 'not allowed';
  end if;
  if (select trigger_kind from public.automation_templates where key = p_key) is distinct from 'schedule' then
    raise exception 'only scheduled automations can be run on demand';
  end if;
  if not v_cfg.enabled then
    raise exception 'automation is disabled';
  end if;
  v_result := public.automation_dispatch(p_org_id, p_key, v_cfg.params, true);
  perform set_config('app.automation', '', true);
  return v_result;
end;
$$;

grant execute on function public.run_automation_now(uuid, text) to authenticated;

-- Programación cada 15 minutos (si pg_cron está disponible en el entorno)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('kairos-automations', '*/15 * * * *', 'select public.run_automations()');
exception when others then
  raise notice 'pg_cron no disponible: las automatizaciones programadas solo correrán con "Ejecutar ahora" (%).', sqlerrm;
end;
$$;
