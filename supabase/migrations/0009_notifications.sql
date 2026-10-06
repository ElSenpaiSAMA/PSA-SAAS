-- ============================================================
-- 0009 · Notificaciones dentro de la app
--
-- Cada notificación es privada de su destinatario (una membresía).
-- No las crea el cliente: las generan triggers de la base cuando
-- pasa algo relevante, así ningún flujo "se olvida" de avisar y
-- no se pueden fabricar avisos falsos desde el navegador.
--
-- También define quién aprueba las vacaciones de cada persona
-- (vacation_approvers), que la UI usa para decir "lo aprueba X".
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  recipient_id uuid not null references public.memberships (id) on delete cascade,
  actor_id uuid references public.memberships (id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: select own"
  on public.notifications for select
  using (public.is_own_membership(recipient_id));

-- Solo se puede marcar como leída (o no leída); el resto es inmutable (ver guard)
create policy "notifications: update own"
  on public.notifications for update
  using (public.is_own_membership(recipient_id))
  with check (public.is_own_membership(recipient_id));

create policy "notifications: delete own"
  on public.notifications for delete
  using (public.is_own_membership(recipient_id));

-- Sin política de insert: el cliente no crea notificaciones.

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'only read_at can be changed';
  end if;
  return new;
end;
$$;

create trigger trg_notifications_guard
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

-- ¿El rol de esta membresía (activa) tiene el permiso?
create or replace function public.membership_can(p_membership_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.id = p_membership_id and m.status = 'active' and rp.permission_key = p_permission
  );
$$;

-- Quién aprueba las vacaciones de una persona: el primer responsable hacia
-- arriba en su línea de reporte que tenga vacations.approve. Si no hay
-- ninguno, administración (employees.manage + vacations.approve).
create or replace function public.vacation_approvers(p_membership_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_current uuid := (select manager_id from public.memberships where id = p_membership_id);
  v_depth int := 0;
  v_org uuid := public.membership_org(p_membership_id);
begin
  -- Solo miembros de la misma organización pueden consultarlo (auth.uid() nulo = sistema)
  if auth.uid() is not null and not public.is_org_member(v_org) then
    return;
  end if;
  while v_current is not null and v_depth < 20 loop
    if public.membership_can(v_current, 'vacations.approve') then
      return next v_current;
      return;
    end if;
    v_current := (select manager_id from public.memberships where id = v_current);
    v_depth := v_depth + 1;
  end loop;
  return query
    select m.id from public.memberships m
    where m.org_id = v_org and m.status = 'active' and m.id <> p_membership_id
      and public.membership_can(m.id, 'employees.manage')
      and public.membership_can(m.id, 'vacations.approve');
end;
$$;

grant execute on function public.vacation_approvers(uuid) to authenticated;

-- Inserta una notificación (no se avisa a uno mismo de lo que hizo).
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
  v_actor uuid := public.my_membership_id(p_org_id);
begin
  if p_recipient_id is null or p_recipient_id = v_actor then
    return;
  end if;
  insert into public.notifications (org_id, recipient_id, actor_id, kind, title, body, link, entity_type, entity_id)
  values (p_org_id, p_recipient_id, v_actor, p_kind, p_title, p_body, p_link, p_entity_type, p_entity_id);
end;
$$;

-- Solo la usan los triggers
revoke execute on function public.notify(uuid, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.member_name(p_membership_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(p.full_name, ''), p.email, 'Alguien')
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.id = p_membership_id;
$$;

create or replace function public.fmt_range(p_from date, p_to date)
returns text
language sql
immutable
as $$
  select case when p_from = p_to then to_char(p_from, 'DD/MM') else to_char(p_from, 'DD/MM') || ' – ' || to_char(p_to, 'DD/MM') end;
$$;

-- ------------------------------------------------------------
-- Triggers que generan notificaciones
-- ------------------------------------------------------------

-- Vacaciones: pedidas → aprobadores; decididas → solicitante; canceladas → aprobadores
create or replace function public.notify_vacation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.membership_org(new.membership_id);
  v_link text := '/app/' || v_org || '/inbox';
  v_who text := public.member_name(new.membership_id);
  v_range text := public.fmt_range(new.start_date, new.end_date);
  v_approver uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(v_org, v_approver, 'vacation.requested',
        v_who || ' pidió vacaciones', v_range || ' · pendiente de tu aprobación', v_link, 'vacation_request', new.id);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify(v_org, new.membership_id, 'vacation.decided',
      case when new.status = 'approved' then 'Tus vacaciones fueron aprobadas' else 'Tus vacaciones fueron rechazadas' end,
      v_range || coalesce(' · ' || public.member_name(new.decided_by), ''),
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

create trigger trg_notify_vacations
  after insert or update on public.vacation_requests
  for each row execute function public.notify_vacation_change();

-- Tareas: asignación nueva → la persona asignada
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.membership_org(new.assigned_to);
begin
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform public.notify(v_org, new.assigned_to, 'task.assigned',
      'Te asignaron una tarea', new.title || coalesce(' · ' || (select name from public.projects where id = new.project_id), ''),
      '/app/' || v_org || '/projects/' || new.project_id, 'task', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_notify_tasks
  after insert or update of assigned_to on public.tasks
  for each row execute function public.notify_task_assignment();

-- Proyectos: alta como miembro → la persona sumada
create or replace function public.notify_project_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project record;
begin
  select id, org_id, name into v_project from public.projects where id = new.project_id;
  perform public.notify(v_project.org_id, new.membership_id, 'project.added',
    'Te sumaron a un proyecto', v_project.name, '/app/' || v_project.org_id || '/projects/' || v_project.id, 'project', v_project.id);
  return new;
end;
$$;

create trigger trg_notify_project_members
  after insert on public.project_members
  for each row execute function public.notify_project_member();

-- Órdenes de trabajo: cerrada sin facturar → quienes facturan
create or replace function public.notify_work_order_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
  v_project text := (select name from public.projects where id = new.project_id);
begin
  if new.status = 'closed' and old.status <> 'closed' and new.billing_status = 'unbilled' then
    for v_member in
      select m.id from public.memberships m
      where m.org_id = new.org_id and m.status = 'active' and public.membership_can(m.id, 'billing.manage')
    loop
      perform public.notify(new.org_id, v_member, 'work_order.to_invoice',
        'OT lista para facturar', new.title || coalesce(' · ' || v_project, ''),
        '/app/' || new.org_id || '/work-orders/' || new.id, 'work_order', new.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_notify_work_orders
  after update of status on public.work_orders
  for each row execute function public.notify_work_order_closed();
