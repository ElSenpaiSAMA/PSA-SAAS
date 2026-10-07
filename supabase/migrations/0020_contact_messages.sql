-- ============================================================
-- 0020 · Mensajes de la web
--
-- El formulario de contacto de la web pública deja de ser visual:
-- cada consulta se guarda y la gestiona la empresa desde la intranet.
--
--   organizations.receives_web_contact → la empresa que recibe los
--     mensajes de la web (una sola por instalación)
--   contact_messages → consulta: datos de contacto, barco, servicio,
--     mensaje y estado (nuevo → en curso → cerrado)
--
-- La web no escribe en la tabla: llama a submit_contact_message
-- (security definer), que valida, limita envíos repetidos y la guarda.
-- Lo leen y gestionan quienes tienen contact.manage (owner/admin), a
-- quienes se avisa en la campana con cada mensaje nuevo.
-- ============================================================

insert into public.permissions (key, description) values
  ('contact.manage', 'Ver y gestionar los mensajes del formulario de contacto de la web');
insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'contact.manage'),
  ('admin', 'contact.manage');

-- 1 · Qué empresa recibe los mensajes de la web
alter table public.organizations
  add column receives_web_contact boolean not null default false;

create unique index organizations_web_contact_idx
  on public.organizations (receives_web_contact) where receives_web_contact;

-- Lo decide la instalación (seed / SQL), no un admin desde la app
create or replace function public.guard_organization_web_contact()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.receives_web_contact is distinct from old.receives_web_contact then
    raise exception 'receives_web_contact cannot be changed from the app';
  end if;
  return new;
end;
$$;

create trigger trg_organizations_guard_web_contact
  before update on public.organizations
  for each row execute function public.guard_organization_web_contact();

-- En una base existente, la empresa de la web es Diplonautic
update public.organizations
set receives_web_contact = true
where id = (select id from public.organizations where name = 'Diplonautic' order by created_at limit 1)
  and not exists (select 1 from public.organizations where receives_web_contact);

-- 2 · Mensajes
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  email text not null check (length(email) between 3 and 254 and email like '%_@_%'),
  phone text check (length(phone) <= 20),
  boat_type text not null check (length(boat_type) between 1 and 40),
  boat_model text check (length(boat_model) <= 80),
  service text not null check (length(service) between 1 and 80),
  message text not null check (length(message) between 10 and 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  handled_by uuid references public.memberships (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index contact_messages_org_idx on public.contact_messages (org_id, created_at desc);
create index contact_messages_new_idx on public.contact_messages (org_id) where status = 'new';
create index contact_messages_email_idx on public.contact_messages (lower(email), created_at desc);

alter table public.contact_messages enable row level security;

create policy "contact_messages: select with contact.manage"
  on public.contact_messages for select
  using (public.has_permission(org_id, 'contact.manage'));

create policy "contact_messages: update with contact.manage"
  on public.contact_messages for update
  using (public.has_permission(org_id, 'contact.manage'))
  with check (public.has_permission(org_id, 'contact.manage'));

create policy "contact_messages: delete with contact.manage"
  on public.contact_messages for delete
  using (public.has_permission(org_id, 'contact.manage'));

-- Sin política de insert: solo entra por submit_contact_message.

-- Al gestionarlo solo cambia el estado; quién y cuándo lo pone la base
create or replace function public.guard_contact_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'status' - 'handled_by' - 'handled_at') is distinct from (to_jsonb(old) - 'status' - 'handled_by' - 'handled_at') then
    raise exception 'only the status of a contact message can be changed';
  end if;
  if new.status is distinct from old.status then
    new.handled_by := public.my_membership_id(new.org_id);
    new.handled_at := now();
  else
    new.handled_by := old.handled_by;
    new.handled_at := old.handled_at;
  end if;
  return new;
end;
$$;

create trigger trg_contact_messages_guard
  before update on public.contact_messages
  for each row execute function public.guard_contact_message_update();

create trigger trg_audit_contact_messages
  after update or delete on public.contact_messages
  for each row execute function audit.log_change();

-- 3 · Entrada desde la web (anónima)
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_phone text,
  p_boat_type text,
  p_boat_model text,
  p_service text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := (select id from public.organizations where receives_web_contact);
  v_id uuid;
begin
  if v_org is null then
    raise exception 'contact inbox is not configured';
  end if;

  -- Freno a envíos repetidos: 3 por email por hora y 60 en total por hora
  if (select count(*) from public.contact_messages
      where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour') >= 3
    or (select count(*) from public.contact_messages
      where org_id = v_org and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many contact messages';
  end if;

  insert into public.contact_messages (org_id, name, email, phone, boat_type, boat_model, service, message)
  values (
    v_org,
    trim(p_name),
    lower(trim(p_email)),
    nullif(trim(p_phone), ''),
    trim(p_boat_type),
    nullif(trim(p_boat_model), ''),
    trim(p_service),
    trim(p_message)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.submit_contact_message(text, text, text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text, text, text) to anon, authenticated;

-- 4 · Aviso a quien gestiona los mensajes
create or replace function public.notify_contact_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  for v_recipient in
    select m.id from public.memberships m
    where m.org_id = new.org_id and m.status = 'active'
      and public.membership_can(m.id, 'contact.manage')
  loop
    perform public.notify(new.org_id, v_recipient, 'contact.received',
      'Nuevo mensaje de la web: ' || new.name,
      new.service || ' · ' || new.boat_type || coalesce(' ' || new.boat_model, ''),
      '/app/' || new.org_id || '/contact?id=' || new.id, 'contact_message', new.id);
  end loop;
  return new;
end;
$$;

create trigger trg_contact_messages_notify
  after insert on public.contact_messages
  for each row execute function public.notify_contact_message();

-- Contador del menú: mensajes sin abrir
create or replace function public.contact_new_count(p_org_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int from public.contact_messages where org_id = p_org_id and status = 'new';
$$;

grant execute on function public.contact_new_count(uuid) to authenticated;
