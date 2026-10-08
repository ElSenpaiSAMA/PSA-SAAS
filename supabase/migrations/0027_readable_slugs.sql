-- URL legibles: proyectos, órdenes de trabajo y personas tienen un "slug" (el nombre
-- en formato URL, p. ej. "climatizacion-princess-v58"), único dentro de la empresa.
-- Lo calcula siempre la base: al crear y al renombrar. Si dos nombres coinciden, el
-- segundo lleva "-2", el tercero "-3", etc. Los enlaces con el id siguen funcionando
-- (la app redirige a la URL legible).

-- ------------------------------------------------------------
-- slugify: minúsculas, sin tildes, solo letras, números y guiones
-- ------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      left(
        trim(both '-' from regexp_replace(
          translate(lower(coalesce(p_text, '')),
            'áàäâãéèëêíìïîóòöôõúùüûñçß·',
            'aaaaaeeeeiiiiooooouuuuncs-'),
          '[^a-z0-9]+', '-', 'g')),
        60),
      ''),
    'sin-nombre')
$$;

-- Primer slug libre dentro de la empresa para esa tabla (sin contar la propia fila)
create or replace function public.unique_slug(p_table regclass, p_org uuid, p_base text, p_self uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text := p_base;
  v_n int := 1;
  v_taken boolean;
begin
  loop
    execute format('select exists(select 1 from %s where org_id = $1 and slug = $2 and id is distinct from $3)', p_table)
      into v_taken using p_org, v_slug, p_self;
    exit when not v_taken;
    v_n := v_n + 1;
    v_slug := left(p_base, 56) || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

alter table public.projects add column slug text;
alter table public.work_orders add column slug text;
alter table public.memberships add column slug text;

-- ------------------------------------------------------------
-- Triggers: el slug sale del nombre y no se puede fijar a mano
-- ------------------------------------------------------------
create or replace function public.set_project_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name or new.slug is distinct from old.slug or new.slug is null then
    new.slug := public.unique_slug('public.projects', new.org_id, public.slugify(new.name), new.id);
  end if;
  return new;
end;
$$;

create or replace function public.set_work_order_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.title is distinct from old.title or new.slug is distinct from old.slug or new.slug is null then
    new.slug := public.unique_slug('public.work_orders', new.org_id, public.slugify(new.title), new.id);
  end if;
  return new;
end;
$$;

-- Personas: el nombre vive en profiles (o, si no hay, la parte del email antes de la @)
create or replace function public.member_slug_base(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.slugify(coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)))
  from public.profiles p where p.id = p_user
$$;

create or replace function public.set_membership_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Siempre se recalcula: así nadie puede elegir un slug a mano
  new.slug := public.unique_slug('public.memberships', new.org_id, coalesce(public.member_slug_base(new.user_id), 'persona'), new.id);
  return new;
end;
$$;

-- "zz_": corre después de los demás triggers BEFORE (que van en orden alfabético)
create trigger zz_projects_slug before insert or update on public.projects
  for each row execute function public.set_project_slug();
create trigger zz_work_orders_slug before insert or update on public.work_orders
  for each row execute function public.set_work_order_slug();
create trigger zz_memberships_slug before insert or update on public.memberships
  for each row execute function public.set_membership_slug();

-- Cuando cambia el nombre de una persona, se actualizan sus slugs
create or replace function public.sync_member_slugs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships set slug = null where user_id = new.id;
  return null;
end;
$$;

create trigger profiles_sync_member_slugs after update of full_name on public.profiles
  for each row when (new.full_name is distinct from old.full_name)
  execute function public.sync_member_slugs();

-- El control de cambios de memberships deja pasar los cambios que solo tocan el slug
-- (los hace la base al renombrar a alguien; el valor lo fija siempre set_membership_slug)
create or replace function public.guard_membership_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_role text;
  v_my_level smallint;
  v_old_level smallint;
  v_new_level smallint;
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'slug') = (to_jsonb(old) - 'slug') then
    return new;
  end if;

  -- Solo quien dirige una rama tiene rama, y tiene que ser de la misma empresa
  if new.role_id <> 'director' then
    new.directs_branch_id := null;
  elsif new.directs_branch_id is not null
     and (select org_id from public.branches where id = new.directs_branch_id) <> new.org_id then
    raise exception 'branch must belong to the same organization';
  end if;

  -- Llamadas desde funciones internas/servicio (sin usuario) no se restringen
  if auth.uid() is null then
    return new;
  end if;

  select m.role_id, r.level into v_my_role, v_my_level
  from public.memberships m join public.roles r on r.id = m.role_id
  where m.org_id = new.org_id and m.user_id = auth.uid() and m.status = 'active';

  if new.user_id = auth.uid()
     and (new.role_id <> old.role_id or new.status <> old.status or new.directs_branch_id is distinct from old.directs_branch_id) then
    raise exception 'cannot change your own role or status';
  end if;

  -- El superadmin (plataforma) no se crea ni se toca desde la empresa
  if (old.role_id = 'superadmin' or new.role_id = 'superadmin') and v_my_role is distinct from 'superadmin' then
    raise exception 'superadmin is managed by the platform';
  end if;

  select level into v_old_level from public.roles where id = old.role_id;
  select level into v_new_level from public.roles where id = new.role_id;

  -- No se gestiona a alguien de nivel igual o superior, ni se asigna un nivel >= al propio
  -- (el CEO y el superadmin pueden todo dentro de la empresa)
  if v_my_role not in ('owner', 'superadmin') and (v_old_level >= v_my_level or v_new_level >= v_my_level) then
    raise exception 'insufficient rank for this change';
  end if;

  if new.manager_id is not null and public.membership_org(new.manager_id) <> new.org_id then
    raise exception 'manager must belong to the same organization';
  end if;

  if new.manager_id is not null and public.is_in_reporting_line(new.id, new.manager_id) then
    raise exception 'manager assignment would create a cycle';
  end if;

  if new.org_id <> old.org_id or new.user_id <> old.user_id then
    raise exception 'org_id and user_id are immutable';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Datos existentes: se calculan en orden de creación (el más antiguo se queda el nombre limpio).
-- La auditoría se pausa: completar el slug no es un cambio que haya hecho una persona.
-- ------------------------------------------------------------
alter table public.projects disable trigger trg_audit_projects;
alter table public.work_orders disable trigger trg_audit_work_orders;
alter table public.memberships disable trigger trg_audit_memberships;

do $$
declare r record;
begin
  for r in select id from public.projects order by created_at, id loop
    update public.projects set slug = null where id = r.id;
  end loop;
  for r in select id from public.work_orders order by created_at, id loop
    update public.work_orders set slug = null where id = r.id;
  end loop;
  for r in select id from public.memberships order by created_at, id loop
    update public.memberships set slug = null where id = r.id;
  end loop;
end;
$$;

alter table public.projects enable trigger trg_audit_projects;
alter table public.work_orders enable trigger trg_audit_work_orders;
alter table public.memberships enable trigger trg_audit_memberships;

alter table public.projects alter column slug set not null;
alter table public.work_orders alter column slug set not null;
alter table public.memberships alter column slug set not null;

create unique index projects_org_slug_key on public.projects (org_id, slug);
create unique index work_orders_org_slug_key on public.work_orders (org_id, slug);
create unique index memberships_org_slug_key on public.memberships (org_id, slug);
