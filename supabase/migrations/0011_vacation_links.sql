-- ============================================================
-- 0011 · Las solicitudes de vacaciones se deciden en Vacaciones → Equipo
--
-- Las aprobaciones dejan de ser un "pendiente" de la bandeja: el aviso
-- llega como notificación y su enlace lleva a la pestaña del equipo,
-- donde quien aprueba ve las solicitudes, el calendario y los saldos.
-- ============================================================

create or replace function public.notify_vacation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.membership_org(new.membership_id);
  v_team_link text := '/app/' || v_org || '/vacations?tab=equipo';
  v_who text := public.member_name(new.membership_id);
  v_range text := public.fmt_range(new.start_date, new.end_date);
  v_approver uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending'
     and (select status from public.vacation_requests where id = new.id) = 'pending' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(v_org, v_approver, 'vacation.requested',
        v_who || ' pidió vacaciones', v_range || ' · pendiente de tu aprobación', v_team_link, 'vacation_request', new.id);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.notify(v_org, new.membership_id, 'vacation.decided',
      case when new.status = 'approved' then 'Tus vacaciones fueron aprobadas' else 'Tus vacaciones fueron rechazadas' end,
      v_range || coalesce(' · ' || public.member_name(new.decided_by), ' · aprobación automática'),
      '/app/' || v_org || '/vacations', 'vacation_request', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'cancelled' then
    for v_approver in select public.vacation_approvers(new.membership_id) loop
      perform public.notify(v_org, v_approver, 'vacation.cancelled',
        v_who || ' canceló su solicitud', v_range, v_team_link, 'vacation_request', new.id);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.automation_vacations_escalate(p_org_id uuid, p_params jsonb, p_force boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_approver uuid;
  v_target uuid;
  v_count int := 0;
begin
  for v_req in
    select v.* from public.vacation_requests v
    where public.membership_org(v.membership_id) = p_org_id and v.status = 'pending'
      and v.created_at < now() - make_interval(days => (p_params ->> 'after_days')::int)
  loop
    if not public.automation_mark(p_org_id, 'vacations.escalate_stale', v_req.id::text, 'vacation_request', v_req.id,
         public.member_name(v_req.membership_id) || ' · ' || public.fmt_range(v_req.start_date, v_req.end_date)) then
      continue;
    end if;
    for v_approver in select public.vacation_approvers(v_req.membership_id) loop
      for v_target in
        select x from public.vacation_approvers(v_approver) x
        union
        select m.id from public.memberships m
        where m.org_id = p_org_id and m.status = 'active' and public.membership_can(m.id, 'employees.manage')
      loop
        if v_target <> v_req.membership_id then
          perform public.notify(p_org_id, v_target, 'vacation.escalated',
            'Solicitud sin respuesta hace ' || (p_params ->> 'after_days') || ' días',
            public.member_name(v_req.membership_id) || ' · ' || public.fmt_range(v_req.start_date, v_req.end_date)
              || ' · la tiene ' || public.member_name(v_approver),
            '/app/' || p_org_id || '/vacations?tab=equipo', 'vacation_request', v_req.id);
        end if;
      end loop;
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Avisos ya enviados: que también lleven a la pestaña del equipo.
-- (El guard solo deja cambiar read_at; se suspende únicamente para esta corrección.)
alter table public.notifications disable trigger trg_notifications_guard;
update public.notifications
set link = '/app/' || org_id || '/vacations?tab=equipo'
where kind in ('vacation.requested', 'vacation.cancelled', 'vacation.escalated');
alter table public.notifications enable trigger trg_notifications_guard;
