-- ============================================================
-- 0015 · Ajustes de la empresa
--
--   default_annual_vacation_days → días de vacaciones de quien se suma
--   default_weekly_hours         → jornada semanal de quien se suma
--   timezone                     → hora local de la empresa (la usan las
--                                  automatizaciones con horario)
-- Se editan con employees.manage (política existente de organizations).
-- ============================================================

alter table public.organizations
  add column default_annual_vacation_days numeric not null default 22
    check (default_annual_vacation_days between 0 and 60),
  add column default_weekly_hours numeric not null default 40
    check (default_weekly_hours between 1 and 60),
  add column timezone text not null default 'Europe/Madrid';

create or replace function public.guard_organization_changes()
returns trigger
language plpgsql
as $$
begin
  new.name := trim(new.name);
  if length(new.name) < 2 or length(new.name) > 60 then
    raise exception 'organization name must have between 2 and 60 characters';
  end if;
  -- Una zona horaria inválida hace fallar esta conversión
  begin
    perform now() at time zone new.timezone;
  exception when others then
    raise exception 'invalid timezone';
  end;
  return new;
end;
$$;

create trigger trg_organizations_guard
  before insert or update on public.organizations
  for each row execute function public.guard_organization_changes();

create trigger trg_audit_organizations
  after update on public.organizations
  for each row execute function audit.log_change();

-- Quien se suma a la empresa recibe sus valores por defecto. Las altas que no
-- indican jornada ni días (p. ej. aceptar una invitación) llegan con los
-- defaults de la tabla (40 h / 22 días): esos se reemplazan por los de la empresa.
create or replace function public.apply_org_member_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  select * into v_org from public.organizations where id = new.org_id;
  if new.weekly_hours = 40 then
    new.weekly_hours := v_org.default_weekly_hours;
  end if;
  if new.annual_vacation_days = 22 then
    new.annual_vacation_days := v_org.default_annual_vacation_days;
  end if;
  return new;
end;
$$;

create trigger trg_memberships_org_defaults
  before insert on public.memberships
  for each row execute function public.apply_org_member_defaults();

-- La configuración efectiva de una automatización toma la zona horaria de la
-- empresa salvo que la regla indique otra.
create or replace function public.automation_config(p_org_id uuid, p_key text, out enabled boolean, out params jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(r.enabled, t.default_enabled),
         (t.default_params - 'timezone')
           || jsonb_build_object('timezone', o.timezone)
           || coalesce(r.params, '{}'::jsonb)
  from public.automation_templates t
  join public.organizations o on o.id = p_org_id
  left join public.automation_rules r on r.key = t.key and r.org_id = p_org_id
  where t.key = p_key;
$$;
