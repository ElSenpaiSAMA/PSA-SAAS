-- ============================================================
-- 0021 · Perfil del usuario: foto y preferencias de avisos
--
--   Storage "avatars"   → foto de perfil. Lectura pública; cada persona
--                          solo escribe en su carpeta (<user_id>/...).
--   profiles.muted_notifications → avisos que no recibe la persona. Solo
--                          los informativos: lo que pide una acción
--                          (aprobar vacaciones, correcciones) siempre llega.
--                          Lo configura administración, no la persona.
--   Guard de profiles   → desde la app cada persona solo cambia su foto (de
--                          su propia carpeta). El nombre lo pone ella una
--                          sola vez, al activar la cuenta; después lo cambia
--                          administración con set_member_name. El email lo
--                          sincroniza el sistema.
-- ============================================================

-- 1 · Preferencias de avisos
create or replace function public.mutable_notification_kinds()
returns text[]
language sql
immutable
as $$
  select array[
    'forum.reply', 'forum.notice', 'forum.mention',
    'task.assigned', 'task.due_soon', 'task.overdue', 'project.added',
    'clock.reminder', 'clock.auto_closed', 'team.weekly_summary',
    'work_order.created', 'work_order.budget', 'work_order.auto_closed', 'work_order.to_invoice',
    'contact.received'
  ]::text[];
$$;

alter table public.profiles
  add column muted_notifications text[] not null default '{}'
    check (muted_notifications <@ public.mutable_notification_kinds());

-- 2 · Qué se puede cambiar del propio perfil
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $
begin
  new.full_name := nullif(trim(new.full_name), '');
  if new.full_name is not null and length(new.full_name) not between 2 and 80 then
    raise exception 'name must have between 2 and 80 characters';
  end if;
  -- Sistema (triggers de Auth, seed) y funciones de la base como set_member_name
  -- (corren como su dueño, no como "authenticated"): sin más restricciones
  if auth.uid() is null or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email or new.created_at is distinct from old.created_at then
    raise exception 'only the photo can be changed';
  end if;
  if new.muted_notifications is distinct from old.muted_notifications then
    raise exception 'notification settings are managed by administration';
  end if;
  -- El nombre se elige al activar la cuenta; después lo cambia administración
  if new.full_name is distinct from old.full_name and old.full_name is not null then
    raise exception 'name is managed by administration';
  end if;
  -- La foto tiene que estar en la carpeta propia del bucket de avatares
  if new.avatar_url is not null and new.avatar_url not like '%/storage/v1/object/public/avatars/' || new.id || '/%' then
    raise exception 'avatar must be uploaded to your own folder';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Administración corrige el nombre de una persona de su empresa. Mismo criterio que
-- para editar el rol: employees.manage y rango mayor (el owner puede con todos).
create or replace function public.set_member_name(p_membership_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $
declare
  v_target public.memberships;
  v_me public.memberships;
begin
  select * into v_target from public.memberships where id = p_membership_id;
  if v_target.id is null or not public.has_permission(v_target.org_id, 'employees.manage') then
    raise exception 'not allowed to rename this member';
  end if;
  select * into v_me from public.memberships where id = public.my_membership_id(v_target.org_id);
  if v_me.role_id <> 'owner'
     and (select level from public.roles where id = v_me.role_id) <= (select level from public.roles where id = v_target.role_id) then
    raise exception 'not allowed to rename this member';
  end if;
  update public.profiles set full_name = p_name where id = v_target.user_id;
end;
$;

revoke execute on function public.set_member_name(uuid, text) from public, anon;
grant execute on function public.set_member_name(uuid, text) to authenticated;

-- 3 · Fotos de perfil (Supabase Storage)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: replace own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4 · Los avisos respetan las preferencias de quien los recibe
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
  if exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.id = p_recipient_id and p_kind = any (p.muted_notifications)
  ) then
    return;
  end if;
  insert into public.notifications (org_id, recipient_id, actor_id, kind, title, body, link, entity_type, entity_id)
  values (p_org_id, p_recipient_id, v_actor, p_kind, p_title, p_body, p_link, p_entity_type, p_entity_id);
end;
$$;

revoke execute on function public.notify(uuid, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
