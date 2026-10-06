-- ============================================================
-- 0008 · Ficha de empleado (datos personales y sensibles) con historial
--
-- Cada cambio de la ficha es una VERSIÓN con fecha de vigencia
-- (effective_from). La ficha "a una fecha" es la última versión
-- vigente en ese momento. Esto permite:
--   · registrar cambios con efecto futuro o pasado (subida de sueldo
--     desde el 1 de marzo, cambio de contrato…);
--   · navegar en el tiempo y ver qué cambió y cuándo.
--
-- Acceso:
--   · ver y editar: permiso people.sensitive (owner/admin);
--   · ver la propia ficha: el propio empleado (solo lectura);
--   · managers y resto: sin acceso (ven datos laborales, no sensibles).
-- ============================================================

insert into public.permissions (key, description) values
  ('people.sensitive', 'Ver y editar datos personales y salariales de los empleados');
insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'people.sensitive'),
  ('admin', 'people.sensitive');

create table public.employee_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  effective_from date not null,

  -- Identidad y contacto
  national_id text,                       -- DNI / NIE / pasaporte
  birth_date date,
  phone text,
  personal_email text,
  address text,
  emergency_contact text,

  -- Contrato
  hire_date date,
  contract_type text check (contract_type in ('indefinido', 'temporal', 'practicas', 'freelance')),
  -- Retribución
  salary_annual numeric(12, 2) check (salary_annual is null or salary_annual >= 0),
  salary_currency text not null default 'EUR',
  iban text,

  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (membership_id, effective_from)
);

create index employee_records_membership_idx on public.employee_records (membership_id, effective_from desc);

alter table public.employee_records enable row level security;

create policy "employee_records: select own or people.sensitive"
  on public.employee_records for select
  using (public.is_own_membership(membership_id) or public.has_permission(org_id, 'people.sensitive'));

create policy "employee_records: insert with people.sensitive"
  on public.employee_records for insert
  with check (public.has_permission(org_id, 'people.sensitive'));

create policy "employee_records: update with people.sensitive"
  on public.employee_records for update
  using (public.has_permission(org_id, 'people.sensitive'))
  with check (public.has_permission(org_id, 'people.sensitive'));

create policy "employee_records: delete with people.sensitive"
  on public.employee_records for delete
  using (public.has_permission(org_id, 'people.sensitive'));

-- La organización se deduce de la membresía (no se confía en el cliente)
-- y la persona de una versión no se puede cambiar.
create or replace function public.guard_employee_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.membership_id <> old.membership_id then
    raise exception 'membership is immutable';
  end if;
  new.org_id := public.membership_org(new.membership_id);
  if new.org_id is null then
    raise exception 'membership not found';
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger trg_employee_records_guard
  before insert or update on public.employee_records
  for each row execute function public.guard_employee_record();

create trigger trg_audit_employee_records
  after insert or update or delete on public.employee_records
  for each row execute function audit.log_change();
