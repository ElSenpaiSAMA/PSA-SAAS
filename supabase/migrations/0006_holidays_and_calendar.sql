-- ============================================================
-- 0006_holidays_and_calendar.sql
-- Festivos por organización y datos para el calendario general.
--   * Los festivos no cuentan como días hábiles (vacaciones) ni como capacidad.
--   * Ausencias del equipo: todos ven las vacaciones aprobadas de su organización
--     (solo fechas, sin motivo); las pendientes, solo el solicitante y quien aprueba.
-- ============================================================

insert into public.permissions (key, description) values
  ('holidays.manage', 'Gestionar los festivos de la empresa');
insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'holidays.manage'),
  ('admin', 'holidays.manage');

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  date date not null,
  name text not null check (length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (org_id, date)
);

alter table public.holidays enable row level security;

create policy "holidays: select within own org"
  on public.holidays for select
  using (public.is_org_member(org_id));

create policy "holidays: insert with holidays.manage"
  on public.holidays for insert
  with check (public.has_permission(org_id, 'holidays.manage'));

create policy "holidays: update with holidays.manage"
  on public.holidays for update
  using (public.has_permission(org_id, 'holidays.manage'))
  with check (public.has_permission(org_id, 'holidays.manage'));

create policy "holidays: delete with holidays.manage"
  on public.holidays for delete
  using (public.has_permission(org_id, 'holidays.manage'));

create trigger trg_audit_holidays
  after insert or update or delete on public.holidays
  for each row execute function audit.log_change();

-- ------------------------------------------------------------
-- Días hábiles de una organización: lunes a viernes menos sus festivos
-- ------------------------------------------------------------
create or replace function public.business_days(p_start date, p_end date, p_org_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from generate_series(p_start, p_end, interval '1 day') d
  where extract(isodow from d) < 6
    and not exists (select 1 from public.holidays h where h.org_id = p_org_id and h.date = d::date);
$$;

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
  and extract(year from vr.start_date) = extract(year from current_date)
group by m.id, m.org_id, m.annual_vacation_days;

-- ------------------------------------------------------------
-- Ausencias para el calendario
-- ------------------------------------------------------------
create or replace function public.org_absences(p_org_id uuid, p_from date, p_to date)
returns table (membership_id uuid, start_date date, end_date date, status text)
language sql
stable
security definer
set search_path = public
as $$
  select vr.membership_id, vr.start_date, vr.end_date, vr.status
  from public.vacation_requests vr
  join public.memberships m on m.id = vr.membership_id
  where m.org_id = p_org_id
    and m.status = 'active'
    and vr.start_date <= p_to
    and vr.end_date >= p_from
    and public.is_org_member(p_org_id)
    and (
      vr.status = 'approved'
      or (
        vr.status = 'pending'
        and (public.is_own_membership(vr.membership_id) or public.can_supervise(vr.membership_id, 'vacations.approve'))
      )
    );
$$;
