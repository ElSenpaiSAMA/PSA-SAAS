-- ============================================================
-- 0024 · El superadmin tiene acceso a todo
--
-- El superadmin (el desarrollador) ve y gestiona toda la empresa, además de lo
-- que es solo suyo: el registro de errores y la estructura de permisos por rama
-- y departamento (platform.manage). El CEO sigue teniendo todo lo de la empresa
-- menos la plataforma.
--
-- También recibe los avisos de la empresa y elige cuáles (sus preferencias de
-- avisos no están bloqueadas, como sí lo están para el resto, que las configura
-- administración). Lo que sigue igual: no aprueba vacaciones (nunca es el
-- aprobador de nadie), no aparece en los listados y nadie de la empresa lo toca.
-- ============================================================

create or replace function public.membership_can(p_membership_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select m.* from public.memberships m where m.id = p_membership_id and m.status = 'active'
  )
  select
    -- El superadmin, todo; el CEO, todo lo de la empresa (no la plataforma)
    exists (select 1 from me where me.role_id = 'superadmin')
    or exists (select 1 from me where me.role_id = 'owner' and p_permission <> 'platform.manage')
    or exists (
      select 1 from me join public.role_permissions rp on rp.role_id = me.role_id
      where rp.permission_key = p_permission
    )
    or exists (
      select 1 from me join public.branch_permissions bp on bp.branch_id = me.directs_branch_id
      where me.role_id = 'director' and bp.permission_key = p_permission
    )
    or exists (
      select 1 from me
      join public.departments d on d.head_id = me.id
      join public.department_permissions dp on dp.department_id = d.id
      where dp.permission_key = p_permission
    );
$$;

-- Los avisos vuelven a llegarle al superadmin (y los filtra con sus preferencias)
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

-- Perfil: el superadmin cambia su nombre y sus avisos (el resto, solo la foto)
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  new.full_name := nullif(trim(new.full_name), '');
  if new.full_name is not null and length(new.full_name) not between 2 and 80 then
    raise exception 'name must have between 2 and 80 characters';
  end if;
  -- Sistema (triggers de Auth, seed) y funciones de la base como set_member_name
  if auth.uid() is null or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email or new.created_at is distinct from old.created_at then
    raise exception 'only the photo can be changed';
  end if;
  -- La foto tiene que estar en la carpeta propia del bucket de avatares
  if new.avatar_url is not null and new.avatar_url not like '%/storage/v1/object/public/avatars/' || new.id || '/%' then
    raise exception 'avatar must be uploaded to your own folder';
  end if;
  if public.is_platform_admin() then
    return new;
  end if;
  if new.full_name is distinct from old.full_name and old.full_name is not null then
    raise exception 'name is managed by administration';
  end if;
  if new.muted_notifications is distinct from old.muted_notifications then
    raise exception 'notification settings are managed by administration';
  end if;
  return new;
end;
$$;
