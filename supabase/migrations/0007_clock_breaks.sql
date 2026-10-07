-- ============================================================
-- 0007 · Pausas en el fichaje (almuerzo, descansos)
--
-- Modelo: una jornada es una secuencia de tramos.
--   clock  → trabajando
--   break  → en pausa
-- Pausar cierra el tramo 'clock' abierto y abre un 'break';
-- reanudar cierra el 'break' y abre un 'clock' nuevo.
-- Así el tiempo trabajado sigue siendo la suma de tramos 'clock'
-- (nada que cambiar en los cálculos existentes) y las pausas
-- quedan registradas y auditadas aparte.
-- ============================================================

alter table public.time_entries drop constraint time_entries_entry_type_check;
alter table public.time_entries
  add constraint time_entries_entry_type_check check (entry_type in ('clock', 'break', 'task'));

-- Antes: "clock o con tarea". Ahora: "clock/break o con tarea".
alter table public.time_entries drop constraint time_entries_check;
alter table public.time_entries
  add constraint time_entries_check check (entry_type in ('clock', 'break') or task_id is not null);

-- Una sola pausa abierta por persona, igual que el fichaje
create unique index time_entries_one_open_break
  on public.time_entries (membership_id)
  where entry_type = 'break' and ended_at is null;

-- ------------------------------------------------------------
-- Guards: las pausas se tratan como el fichaje (hora de inicio
-- = ahora, inmutable; solo se pueden cerrar una vez). No se puede
-- estar trabajando y en pausa a la vez.
-- ------------------------------------------------------------
create or replace function public.guard_time_entry_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.task_id is not null and (
    select org_id from public.tasks where id = new.task_id
  ) <> public.membership_org(new.membership_id) then
    raise exception 'task must belong to the same organization';
  end if;
  if new.task_id is not null and auth.uid() is not null then
    if not public.can_view_project((select project_id from public.tasks where id = new.task_id)) then
      raise exception 'not a member of this project';
    end if;
    perform public.open_work_order_for_task(new.task_id);
  end if;
  if new.entry_type in ('clock', 'break') and auth.uid() is not null then
    new.started_at := now();
    new.ended_at := null;
    if exists (
      select 1 from public.time_entries
      where membership_id = new.membership_id
        and entry_type in ('clock', 'break')
        and entry_type <> new.entry_type
        and ended_at is null
    ) then
      raise exception 'clock and break cannot be open at the same time';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_time_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.membership_id <> old.membership_id or new.entry_type <> old.entry_type then
    raise exception 'membership and entry type are immutable';
  end if;
  if old.entry_type in ('clock', 'break') then
    if new.started_at <> old.started_at then
      raise exception 'clock-in time cannot be modified';
    end if;
    if old.ended_at is not null and new.ended_at is distinct from old.ended_at then
      raise exception 'closed clock entries cannot be modified';
    end if;
  end if;
  if new.task_id is not null and (
    select org_id from public.tasks where id = new.task_id
  ) <> public.membership_org(new.membership_id) then
    raise exception 'task must belong to the same organization';
  end if;
  if old.entry_type = 'task' then
    perform public.open_work_order_for_task(old.task_id);
    if new.task_id is distinct from old.task_id then
      perform public.open_work_order_for_task(new.task_id);
    end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Pausar / reanudar de forma atómica (security invoker: RLS y
-- guards aplican igual que si lo hiciera el usuario a mano).
-- ------------------------------------------------------------
create or replace function public.clock_pause(p_org_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_me uuid := public.my_membership_id(p_org_id);
begin
  if v_me is null then
    raise exception 'not a member of this organization';
  end if;
  update public.time_entries
     set ended_at = now()
   where membership_id = v_me and entry_type = 'clock' and ended_at is null;
  if not found then
    raise exception 'not clocked in';
  end if;
  insert into public.time_entries (membership_id, entry_type) values (v_me, 'break');
end;
$$;

create or replace function public.clock_resume(p_org_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_me uuid := public.my_membership_id(p_org_id);
begin
  if v_me is null then
    raise exception 'not a member of this organization';
  end if;
  update public.time_entries
     set ended_at = now()
   where membership_id = v_me and entry_type = 'break' and ended_at is null;
  if not found then
    raise exception 'not on break';
  end if;
  insert into public.time_entries (membership_id, entry_type) values (v_me, 'clock');
end;
$$;

grant execute on function public.clock_pause(uuid) to authenticated;
grant execute on function public.clock_resume(uuid) to authenticated;
