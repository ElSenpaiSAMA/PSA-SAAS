-- ============================================================
-- 0013 · Correcciones de fichaje con aprobación
--
-- El fichaje no se edita a mano (la hora de entrada la pone la base).
-- Si alguien se olvidó de fichar, fichó mal o una automatización
-- cerró su jornada, pide una corrección con motivo. Quien supervisa
-- (time.view_team en su línea de reporte, o administración) la
-- aprueba o la rechaza con motivo; al aprobarla, la base la aplica.
--
--   entry_id     → corrige ese tramo de fichaje
--   entry_id nulo → agrega un tramo olvidado
-- ============================================================

create table public.time_corrections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  entry_id uuid references public.time_entries (id) on delete set null,
  proposed_start timestamptz not null,
  proposed_end timestamptz not null,
  reason text not null check (length(trim(reason)) between 3 and 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text check (decision_note is null or length(decision_note) <= 300),
  decided_by uuid references public.memberships (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (proposed_end > proposed_start),
  check (proposed_end - proposed_start <= interval '16 hours')
);

create index time_corrections_member_idx on public.time_corrections (membership_id, created_at desc);
create index time_corrections_pending_idx on public.time_corrections (org_id) where status = 'pending';

alter table public.time_corrections enable row level security;

create policy "time_corrections: select own or supervised"
  on public.time_corrections for select
  using (public.is_own_membership(membership_id) or public.can_supervise(membership_id, 'time.view_team'));

create policy "time_corrections: insert own"
  on public.time_corrections for insert
  with check (public.is_own_membership(membership_id) and status = 'pending');

create policy "time_corrections: update own (cancel) or supervised (decide)"
  on public.time_corrections for update
  using (public.is_own_membership(membership_id) or public.can_supervise(membership_id, 'time.view_team'));

-- ------------------------------------------------------------
-- Validación al pedir
-- ------------------------------------------------------------
create or replace function public.guard_time_correction_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.org_id := public.membership_org(new.membership_id);
  if new.proposed_end > now() then
    raise exception 'corrections cannot end in the future';
  end if;
  if new.entry_id is not null and not exists (
    select 1 from public.time_entries te
    where te.id = new.entry_id and te.membership_id = new.membership_id and te.entry_type = 'clock' and te.ended_at is not null
  ) then
    raise exception 'only your own closed clock entries can be corrected';
  end if;
  -- No puede pisar otro tramo de trabajo cerrado
  if exists (
    select 1 from public.time_entries te
    where te.membership_id = new.membership_id and te.entry_type = 'clock'
      and te.id is distinct from new.entry_id
      and te.started_at < new.proposed_end and coalesce(te.ended_at, now()) > new.proposed_start
  ) then
    raise exception 'correction overlaps another clock entry';
  end if;
  if exists (
    select 1 from public.time_corrections c
    where c.membership_id = new.membership_id and c.status = 'pending'
      and c.proposed_start < new.proposed_end and c.proposed_end > new.proposed_start
  ) then
    raise exception 'there is already a pending correction for that time';
  end if;
  new.status := 'pending';
  new.decided_by := null;
  new.decided_at := null;
  new.decision_note := null;
  return new;
end;
$$;

create trigger trg_time_corrections_guard_insert
  before insert on public.time_corrections
  for each row execute function public.guard_time_correction_insert();

-- ------------------------------------------------------------
-- Decisión: el solicitante solo cancela; quien supervisa decide (con motivo si rechaza)
-- ------------------------------------------------------------
create or replace function public.guard_time_correction_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (new.membership_id, new.entry_id, new.proposed_start, new.proposed_end, new.reason, new.org_id)
     is distinct from (old.membership_id, old.entry_id, old.proposed_start, old.proposed_end, old.reason, old.org_id) then
    raise exception 'correction details are immutable';
  end if;
  if old.status <> 'pending' then
    raise exception 'only pending corrections can change';
  end if;
  if public.is_own_membership(old.membership_id) then
    if new.status not in ('pending', 'cancelled') then
      raise exception 'you cannot decide on your own correction';
    end if;
    new.decision_note := old.decision_note;
  elsif new.status in ('approved', 'rejected') then
    if new.status = 'rejected' and coalesce(trim(new.decision_note), '') = '' then
      raise exception 'a rejection requires a reason';
    end if;
    new.decided_by := public.my_membership_id(old.org_id);
    new.decided_at := now();
  else
    raise exception 'invalid status transition';
  end if;
  return new;
end;
$$;

create trigger trg_time_corrections_guard_update
  before update on public.time_corrections
  for each row execute function public.guard_time_correction_update();

-- ------------------------------------------------------------
-- Al aprobarse, se aplica. Los guards de time_entries reconocen el flag
-- de sistema (app.automation) para dejar fijar horas pasadas.
-- ------------------------------------------------------------
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
  if new.task_id is not null and auth.uid() is not null and not public.in_automation() then
    if not public.can_view_project((select project_id from public.tasks where id = new.task_id)) then
      raise exception 'not a member of this project';
    end if;
    perform public.open_work_order_for_task(new.task_id);
  end if;
  if new.entry_type in ('clock', 'break') and auth.uid() is not null and not public.in_automation() then
    new.started_at := now();
    new.ended_at := null;
    if exists (
      select 1 from public.time_entries
      where membership_id = new.membership_id
        and entry_type in ('clock', 'break')
        and entry_type <> new.entry_type
        and ended_at is null
    ) then
      raise exception 'clock and break cannot be open at the same time';
    end if;
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
  if auth.uid() is null or public.in_automation() then
    return new;
  end if;
  if new.membership_id <> old.membership_id or new.entry_type <> old.entry_type then
    raise exception 'membership and entry type are immutable';
  end if;
  if old.entry_type in ('clock', 'break') then
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

create or replace function public.apply_time_correction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text := '/app/' || new.org_id || '/time-tracking';
  v_when text := to_char(new.proposed_start at time zone 'Europe/Madrid', 'DD/MM HH24:MI') || ' – ' ||
                 to_char(new.proposed_end at time zone 'Europe/Madrid', 'HH24:MI');
  v_approver uuid;
begin
  if tg_op = 'INSERT' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(new.org_id, v_approver, 'time.correction_requested',
        public.member_name(new.membership_id) || ' pidió corregir un fichaje', v_when || ' · ' || new.reason,
        v_link || '?tab=equipo', 'time_correction', new.id);
    end loop;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'approved' then
    perform public.automation_begin();
    if new.entry_id is not null then
      update public.time_entries set started_at = new.proposed_start, ended_at = new.proposed_end where id = new.entry_id;
    else
      insert into public.time_entries (membership_id, entry_type, started_at, ended_at)
      values (new.membership_id, 'clock', new.proposed_start, new.proposed_end);
    end if;
    perform set_config('app.automation', '', true);
  end if;

  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify(new.org_id, new.membership_id, 'time.correction_decided',
      case when new.status = 'approved' then 'Aprobaron tu corrección de fichaje' else 'Rechazaron tu corrección de fichaje' end,
      v_when || coalesce(' · ' || public.member_name(new.decided_by), '') || coalesce(' · «' || nullif(trim(new.decision_note), '') || '»', ''),
      v_link, 'time_correction', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_time_corrections_apply
  after insert or update on public.time_corrections
  for each row execute function public.apply_time_correction();

create trigger trg_audit_time_corrections
  after insert or update or delete on public.time_corrections
  for each row execute function audit.log_change();
