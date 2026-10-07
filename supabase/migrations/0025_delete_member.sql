-- ============================================================
-- 0025 · Eliminar a una persona
--
-- delete_member(membership) borra a una persona de la empresa: su cuenta
-- (auth.users → perfil, membresía, fichajes, vacaciones, ficha, avisos… en
-- cascada) si no pertenece a otra organización; si pertenece, solo la
-- membresía de esta. No se puede deshacer.
--
-- Quién: quien gestiona personas (employees.manage), sobre alguien de nivel
-- menor (el CEO y el superadmin, sobre cualquiera menos el superadmin; el CEO
-- solo lo borra el superadmin). Nadie se borra a sí mismo.
--
-- Antes de borrar deja un evento en la auditoría con quién era. El borrado en
-- cascada corre como sistema: las reglas del día a día (por ejemplo, no tocar
-- horas de una OT facturada) protegen el trabajo diario, no deben impedir que
-- administración elimine a alguien.
-- ============================================================

-- Quien decidió unas vacaciones puede eliminarse: la decisión queda sin firmante
alter table public.vacation_requests drop constraint if exists vacation_requests_decided_by_fkey;
alter table public.vacation_requests
  add constraint vacation_requests_decided_by_fkey
  foreign key (decided_by) references public.memberships (id) on delete set null;

create or replace function public.delete_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.memberships;
  v_me public.memberships;
  v_my_level smallint;
  v_target_level smallint;
  v_profile public.profiles;
  v_other_orgs int;
begin
  select * into v_target from public.memberships where id = p_membership_id;
  if not found then
    raise exception 'member not found';
  end if;
  if not public.has_permission(v_target.org_id, 'employees.manage') then
    raise exception 'not allowed to delete this member';
  end if;

  select * into v_me from public.memberships where id = public.my_membership_id(v_target.org_id);
  if v_me.id = v_target.id then
    raise exception 'you cannot delete yourself';
  end if;
  if v_target.role_id in ('superadmin', 'owner') and v_me.role_id <> 'superadmin' then
    raise exception 'insufficient rank for this change';
  end if;
  select level into v_my_level from public.roles where id = v_me.role_id;
  select level into v_target_level from public.roles where id = v_target.role_id;
  if v_me.role_id not in ('owner', 'superadmin') and v_target_level >= v_my_level then
    raise exception 'insufficient rank for this change';
  end if;

  -- Queda constancia de quién era y quién lo eliminó
  select * into v_profile from public.profiles where id = v_target.user_id;
  perform public.log_event('member.deleted', jsonb_build_object(
    'membership_id', v_target.id,
    'user_id', v_target.user_id,
    'name', v_profile.full_name,
    'email', v_profile.email,
    'role', v_target.role_id,
    'position', v_target.position
  ), v_target.org_id);

  select count(*) into v_other_orgs from public.memberships where user_id = v_target.user_id and id <> v_target.id;

  -- Desde acá, como sistema (sin usuario en la sesión de esta transacción)
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  if v_other_orgs = 0 then
    delete from auth.users where id = v_target.user_id;
  else
    delete from public.memberships where id = v_target.id;
  end if;
end;
$$;

revoke execute on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;
