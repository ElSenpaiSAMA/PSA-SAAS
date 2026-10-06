-- ============================================================
-- 0018 · Foro: menciones y "nuevo desde tu última visita"
--
--   mentions        → personas mencionadas con @ en un hilo o respuesta;
--                     se les avisa con una notificación (forum.mention)
--   last_author_id  → quién movió el hilo por última vez (para no contar
--                     como novedad la actividad propia)
--   forum_reads     → cuándo vio cada persona el foro por última vez
-- ============================================================

alter table public.forum_threads add column mentions uuid[] not null default '{}';
alter table public.forum_threads add column last_author_id uuid references public.memberships (id) on delete set null;
alter table public.forum_posts add column mentions uuid[] not null default '{}';

update public.forum_threads t
   set last_author_id = coalesce(
     (select p.author_id from public.forum_posts p where p.thread_id = t.id order by p.created_at desc limit 1),
     t.author_id);

-- ------------------------------------------------------------
-- Menciones: solo personas activas de la misma empresa, sin el autor ni repetidos
-- ------------------------------------------------------------
create or replace function public.forum_clean_mentions(p_org_id uuid, p_author_id uuid, p_mentions uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct m.id), '{}')
  from public.memberships m
  where m.id = any (coalesce(p_mentions, '{}'))
    and m.org_id = p_org_id
    and m.status = 'active'
    and m.id is distinct from p_author_id;
$$;

revoke execute on function public.forum_clean_mentions(uuid, uuid, uuid[]) from public, anon, authenticated;

-- Corre después de los guards (orden alfabético), cuando org_id ya está fijado
create or replace function public.forum_mentions_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.mentions := public.forum_clean_mentions(new.org_id, new.author_id, new.mentions);
  if tg_table_name = 'forum_threads' then
    new.last_author_id := new.author_id;
  end if;
  return new;
end;
$$;

create trigger trg_forum_threads_mentions
  before insert on public.forum_threads
  for each row execute function public.forum_mentions_on_insert();
create trigger trg_forum_posts_mentions
  before insert on public.forum_posts
  for each row execute function public.forum_mentions_on_insert();

-- Al editar no se reescriben las menciones (ya se avisó a quien correspondía)
create or replace function public.forum_mentions_immutable()
returns trigger
language plpgsql
as $$
begin
  if not public.in_automation() then
    new.mentions := old.mentions;
    if tg_table_name = 'forum_threads' then
      new.last_author_id := old.last_author_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_forum_threads_mentions_update
  before update on public.forum_threads
  for each row execute function public.forum_mentions_immutable();
create trigger trg_forum_posts_mentions_update
  before update on public.forum_posts
  for each row execute function public.forum_mentions_immutable();

-- Aviso a cada persona mencionada
create or replace function public.notify_forum_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.forum_threads;
  v_member uuid;
begin
  if tg_table_name = 'forum_threads' then
    v_thread := new;
  else
    select * into v_thread from public.forum_threads where id = new.thread_id;
  end if;
  foreach v_member in array new.mentions loop
    perform public.notify(v_thread.org_id, v_member, 'forum.mention',
      public.member_name(new.author_id) || ' te mencionó en «' || v_thread.title || '»',
      left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
      '/app/' || v_thread.org_id || '/forum/' || v_thread.id, 'forum_thread', v_thread.id);
  end loop;
  return null;
end;
$$;

create trigger trg_notify_forum_thread_mentions
  after insert on public.forum_threads
  for each row execute function public.notify_forum_mentions();
create trigger trg_notify_forum_post_mentions
  after insert on public.forum_posts
  for each row execute function public.notify_forum_mentions();

-- Respuesta: quien ya recibe la mención no recibe además el aviso de respuesta
create or replace function public.notify_forum_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.forum_threads;
  v_recipient uuid;
begin
  select * into v_thread from public.forum_threads where id = new.thread_id;
  for v_recipient in
    select v_thread.author_id
    union
    select distinct p.author_id from public.forum_posts p where p.thread_id = new.thread_id and p.id <> new.id
  loop
    if v_recipient is not null and v_recipient is distinct from new.author_id and not (v_recipient = any (new.mentions)) then
      perform public.notify(v_thread.org_id, v_recipient, 'forum.reply',
        public.member_name(new.author_id) || ' respondió en «' || v_thread.title || '»',
        left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
        '/app/' || v_thread.org_id || '/forum/' || v_thread.id, 'forum_thread', v_thread.id);
    end if;
  end loop;
  return null;
end;
$$;

-- Aviso general: quien está mencionado ya recibe la mención
create or replace function public.notify_forum_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  if new.category <> 'notice' then
    return null;
  end if;
  for v_member in select id from public.memberships where org_id = new.org_id and status = 'active' loop
    if v_member is distinct from new.author_id and not (v_member = any (new.mentions)) then
      perform public.notify(new.org_id, v_member, 'forum.notice', 'Nuevo aviso: ' || new.title,
        left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
        '/app/' || new.org_id || '/forum/' || new.id, 'forum_thread', new.id);
    end if;
  end loop;
  return null;
end;
$$;

-- Contadores: además de la última actividad, quién la hizo
create or replace function public.forum_post_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.automation_begin(); -- el guard del hilo deja tocar contadores al sistema
  if tg_op = 'INSERT' then
    update public.forum_threads
       set reply_count = reply_count + 1, last_activity_at = new.created_at, last_author_id = new.author_id
     where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.forum_threads t
       set reply_count = greatest(t.reply_count - 1, 0),
           last_activity_at = coalesce(
             (select max(created_at) from public.forum_posts where thread_id = old.thread_id and id <> old.id),
             t.created_at),
           last_author_id = coalesce(
             (select p.author_id from public.forum_posts p where p.thread_id = old.thread_id and p.id <> old.id order by p.created_at desc limit 1),
             t.author_id)
     where t.id = old.thread_id;
  end if;
  perform set_config('app.automation', '', true);
  return null;
end;
$$;

-- ------------------------------------------------------------
-- Última visita al foro
-- ------------------------------------------------------------
create table public.forum_reads (
  membership_id uuid primary key references public.memberships (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.forum_reads enable row level security;

create policy "forum_reads: own" on public.forum_reads
  for all using (public.is_own_membership(membership_id)) with check (public.is_own_membership(membership_id));

create or replace function public.guard_forum_reads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.org_id := public.membership_org(new.membership_id);
  new.seen_at := now();
  return new;
end;
$$;

create trigger trg_forum_reads_guard
  before insert or update on public.forum_reads
  for each row execute function public.guard_forum_reads();

-- Hilos con actividad de otras personas desde mi última visita (o desde que entré a la empresa)
create or replace function public.forum_unread_count(p_org_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select m.id, coalesce(r.seen_at, m.created_at) as since
    from public.memberships m
    left join public.forum_reads r on r.membership_id = m.id
    where m.org_id = p_org_id and m.user_id = auth.uid() and m.status = 'active'
  )
  select count(*)::int
  from public.forum_threads t, me
  where t.org_id = p_org_id
    and t.last_activity_at > me.since
    and t.last_author_id is distinct from me.id;
$$;
