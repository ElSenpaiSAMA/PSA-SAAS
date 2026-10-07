-- ============================================================
-- 0012 · Tipos de ausencia y motivo de la decisión
--
-- Una solicitud ya no es siempre "vacaciones":
--   vacation  → vacaciones (descuentan saldo)
--   sick      → baja médica
--   personal  → asuntos propios
--   other     → otra ausencia (con motivo)
-- Solo las vacaciones descuentan del saldo anual.
--
-- Al rechazar es obligatorio explicar el motivo (decision_note), que
-- le llega a la persona en la notificación.
--
-- Privacidad: org_absences (calendario de toda la empresa) sigue sin
-- exponer el tipo; una baja médica es un dato de salud. El tipo solo
-- lo ven la persona y quien aprueba (RLS de vacation_requests).
-- ============================================================

alter table public.vacation_requests
  add column kind text not null default 'vacation' check (kind in ('vacation', 'sick', 'personal', 'other')),
  add column decision_note text check (decision_note is null or length(decision_note) <= 300);

create or replace function public.absence_label(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'sick' then 'una baja médica'
    when 'personal' then 'asuntos propios'
    when 'other' then 'una ausencia'
    else 'vacaciones'
  end;
$$;

-- Guard: el tipo no cambia después de pedirse; rechazar exige motivo; el motivo
-- solo lo escribe quien decide.
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
     or new.end_date <> old.end_date
     or new.kind <> old.kind then
    raise exception 'request dates, type and owner are immutable';
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
    new.decision_note := old.decision_note;
  elsif new.status in ('approved', 'rejected') then
    if new.status = 'rejected' and coalesce(trim(new.decision_note), '') = '' then
      raise exception 'a rejection requires a reason';
    end if;
    new.decided_by := public.my_membership_id(public.membership_org(old.membership_id));
    new.decided_at := now();
  else
    raise exception 'invalid status transition';
  end if;
  return new;
end;
$$;

-- Saldo: solo las vacaciones descuentan
drop view public.vacation_balances;
create view public.vacation_balances
with (security_invoker = true) as
select
  m.id as membership_id,
  m.org_id,
  m.annual_vacation_days as allowance,
  extract(year from current_date)::int as year,
  coalesce(sum(public.business_days(vr.start_date, vr.end_date, m.org_id))
    filter (where vr.status = 'approved'), 0)::int as used_days,
  coalesce(sum(public.business_days(vr.start_date, vr.end_date, m.org_id))
    filter (where vr.status = 'pending'), 0)::int as pending_days
from public.memberships m
left join public.vacation_requests vr
  on vr.membership_id = m.id
  and vr.kind = 'vacation'
  and extract(year from vr.start_date) = extract(year from current_date)
group by m.id, m.org_id, m.annual_vacation_days;

-- Avisos con el tipo de ausencia y, si se rechazó, el motivo
create or replace function public.notify_vacation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.membership_org(new.membership_id);
  v_team_link text := '/app/' || v_org || '/vacations?tab=equipo';
  v_who text := public.member_name(new.membership_id);
  v_what text := public.absence_label(new.kind);
  v_range text := public.fmt_range(new.start_date, new.end_date);
  v_approver uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending'
     and (select status from public.vacation_requests where id = new.id) = 'pending' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(v_org, v_approver, 'vacation.requested',
        v_who || ' pidió ' || v_what, v_range || ' · pendiente de tu aprobación', v_team_link, 'vacation_request', new.id);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify(v_org, new.membership_id, 'vacation.decided',
      case when new.status = 'approved' then 'Aprobaron tu solicitud de ' || v_what else 'Rechazaron tu solicitud de ' || v_what end,
      v_range || coalesce(' · ' || public.member_name(new.decided_by), ' · aprobación automática')
        || coalesce(' · «' || nullif(trim(new.decision_note), '') || '»', ''),
      '/app/' || v_org || '/vacations', 'vacation_request', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'cancelled' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(v_org, v_approver, 'vacation.cancelled',
        v_who || ' canceló su solicitud de ' || v_what, v_range, v_team_link, 'vacation_request', new.id);
    end loop;
  end if;
  return new;
end;
$$;

-- La aprobación automática de ausencias cortas aplica a vacaciones y asuntos propios
-- (una baja médica o "otra" ausencia siempre la mira una persona)
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
  if new.status <> 'pending' or not v_cfg.enabled or new.kind not in ('vacation', 'personal') then
    return null;
  end if;
  if public.business_days(new.start_date, new.end_date, v_org) > (v_cfg.params ->> 'max_days')::int
     or new.start_date - current_date < (v_cfg.params ->> 'min_notice_days')::int then
    return null;
  end if;
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
    public.member_name(new.membership_id) || ' · ' || public.absence_label(new.kind) || ' · ' || public.fmt_range(new.start_date, new.end_date));
  perform set_config('app.automation', '', true);
  return null;
end;
$$;
