-- ============================================================
-- 0017 · Una sola empresa: la intranet de Diplonautic
--
-- La plataforma sigue siendo multi-tenant por dentro (RLS por
-- organización), pero esta instalación es de una sola empresa:
--
--   1. Nadie crea organizaciones desde la app.
--   2. El alta la controla el administrador: solo puede registrarse
--      quien tiene una invitación pendiente (el admin la crea desde
--      Personas). Lo valida la base, aunque se llame directo a la API.
--   3. Al registrarse, la invitación se acepta sola: la persona entra
--      directo a la empresa con el rol que le asignó el admin.
-- ============================================================

-- 1 · Sin organizaciones nuevas desde la app
revoke execute on function public.create_organization(text) from public, anon, authenticated;

-- 2 · Registro solo con invitación
-- La regla vive en su propia función (se puede testear sola). El trigger la
-- aplica a todo alta que no sea una carga del sistema: GoTrue (Auth de
-- Supabase) inserta como supabase_auth_admin; el seed y los tests, como postgres.
create or replace function public.signup_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invitations i
    where lower(i.email) = lower(p_email) and i.accepted_at is null
  );
$$;

revoke execute on function public.signup_allowed(text) from public, anon, authenticated;

create or replace function public.guard_signup_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if session_user not in ('postgres', 'supabase_admin') and not public.signup_allowed(new.email) then
    raise exception 'signup requires an invitation';
  end if;
  return new;
end;
$$;

create trigger trg_auth_users_guard_signup
  before insert on auth.users
  for each row execute function public.guard_signup_invitation();

-- 3 · La invitación se acepta al registrarse
create or replace function public.accept_invitations_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  for v_inv in
    select * from public.invitations
    where lower(email) = lower(new.email) and accepted_at is null
  loop
    insert into public.memberships (org_id, user_id, role_id, manager_id, position, department_id)
    values (v_inv.org_id, new.id, v_inv.role_id, v_inv.manager_id, v_inv.position, v_inv.department_id)
    on conflict (org_id, user_id) do update set status = 'active';
    update public.invitations set accepted_at = now() where id = v_inv.id;
  end loop;
  return new;
end;
$$;

-- Corre después de trg_on_auth_user_created (perfil), por orden alfabético
create trigger trg_zz_auth_users_accept_invitations
  after insert on auth.users
  for each row execute function public.accept_invitations_on_signup();
