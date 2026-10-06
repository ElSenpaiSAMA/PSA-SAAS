-- ============================================================
-- 0016 · Foro interno
--
-- Espacio para que el equipo comparta dudas, avisos e incidencias
-- técnicas. Solo lo ven y escriben las personas de la empresa.
--
--   forum_threads → hilo: categoría, título, cuerpo, fijado/cerrado/resuelto
--   forum_posts   → respuestas de un hilo
--
-- Moderación (forum.moderate: owner/admin): fijar, cerrar y borrar
-- cualquier hilo o respuesta. Cada autor edita y borra lo suyo.
-- ============================================================

insert into public.permissions (key, description) values
  ('forum.moderate', 'Moderar el foro: fijar, cerrar y borrar hilos y respuestas');
insert into public.role_permissions (role_id, permission_key) values
  ('owner', 'forum.moderate'),
  ('admin', 'forum.moderate');

create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid references public.memberships (id) on delete set null,
  category text not null check (category in ('question', 'notice', 'incident')),
  title text not null check (length(trim(title)) between 5 and 140),
  body text not null check (length(trim(body)) between 1 and 5000),
  pinned boolean not null default false,
  locked boolean not null default false,
  resolved boolean not null default false,
  reply_count int not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index forum_threads_org_idx on public.forum_threads (org_id, pinned desc, last_activity_at desc);

create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid references public.memberships (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index forum_posts_thread_idx on public.forum_posts (thread_id, created_at);

alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;

-- ── Lectura: solo personas de la empresa ─────────────────────
create policy "forum_threads: select if member"
  on public.forum_threads for select using (public.is_org_member(org_id));
create policy "forum_posts: select if member"
  on public.forum_posts for select using (public.is_org_member(org_id));

-- ── Escritura: siempre a nombre propio ───────────────────────
create policy "forum_threads: insert own"
  on public.forum_threads for insert with check (public.is_own_membership(author_id));
create policy "forum_posts: insert own"
  on public.forum_posts for insert with check (public.is_own_membership(author_id));

-- ── Edición: autor o moderación (el guard decide qué campos) ─
create policy "forum_threads: update author or moderator"
  on public.forum_threads for update
  using (public.is_own_membership(author_id) or public.has_permission(org_id, 'forum.moderate'));
create policy "forum_posts: update author or moderator"
  on public.forum_posts for update
  using (public.is_own_membership(author_id) or public.has_permission(org_id, 'forum.moderate'));

create policy "forum_threads: delete author or moderator"
  on public.forum_threads for delete
  using (public.is_own_membership(author_id) or public.has_permission(org_id, 'forum.moderate'));
create policy "forum_posts: delete author or moderator"
  on public.forum_posts for delete
  using (public.is_own_membership(author_id) or public.has_permission(org_id, 'forum.moderate'));

-- ------------------------------------------------------------
-- Guards
-- ------------------------------------------------------------

-- Al crear: la empresa sale de la membresía del autor (no del cliente)
create or replace function public.guard_forum_thread_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.org_id := public.membership_org(new.author_id);
  new.title := trim(new.title);
  new.reply_count := 0;
  -- Las fechas las fija la base cuando escribe un usuario; la carga del sistema (seed) conserva las suyas
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  new.last_activity_at := new.created_at;
  new.edited_at := null;
  -- Fijar o cerrar al crear es cosa de moderación
  if auth.uid() is not null and not public.has_permission(new.org_id, 'forum.moderate') then
    new.pinned := false;
    new.locked := false;
  end if;
  new.resolved := false;
  return new;
end;
$$;

create trigger trg_forum_threads_guard_insert
  before insert on public.forum_threads
  for each row execute function public.guard_forum_thread_insert();

-- Al editar: el autor cambia el contenido y marca "resuelto";
-- fijar y cerrar solo moderación. Contadores, autor y empresa son del sistema.
create or replace function public.guard_forum_thread_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moderator boolean := public.has_permission(old.org_id, 'forum.moderate');
  v_author boolean := public.is_own_membership(old.author_id);
begin
  if auth.uid() is null or public.in_automation() then
    return new;
  end if;
  if new.org_id <> old.org_id or new.author_id is distinct from old.author_id or new.created_at <> old.created_at then
    raise exception 'thread identity is immutable';
  end if;
  if (new.pinned <> old.pinned or new.locked <> old.locked) and not v_moderator then
    raise exception 'only moderators can pin or lock threads';
  end if;
  if (new.title <> old.title or new.body <> old.body or new.category <> old.category) then
    if not v_author then
      raise exception 'only the author can edit the thread';
    end if;
    new.edited_at := now();
  end if;
  -- Los contadores los mantiene la base
  new.reply_count := old.reply_count;
  new.last_activity_at := old.last_activity_at;
  return new;
end;
$$;

create trigger trg_forum_threads_guard_update
  before update on public.forum_threads
  for each row execute function public.guard_forum_thread_update();

-- Respuestas: misma empresa que el hilo, y no en hilos cerrados
create or replace function public.guard_forum_post_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.forum_threads;
begin
  select * into v_thread from public.forum_threads where id = new.thread_id;
  if not found then
    raise exception 'thread not found';
  end if;
  if public.membership_org(new.author_id) is distinct from v_thread.org_id then
    raise exception 'thread belongs to another organization';
  end if;
  if v_thread.locked and auth.uid() is not null and not public.has_permission(v_thread.org_id, 'forum.moderate') then
    raise exception 'thread is locked';
  end if;
  new.org_id := v_thread.org_id;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  new.edited_at := null;
  return new;
end;
$$;

create trigger trg_forum_posts_guard_insert
  before insert on public.forum_posts
  for each row execute function public.guard_forum_post_insert();

create or replace function public.guard_forum_post_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.thread_id <> old.thread_id or new.org_id <> old.org_id or new.author_id is distinct from old.author_id
     or new.created_at <> old.created_at then
    raise exception 'post identity is immutable';
  end if;
  if new.body <> old.body then
    if not public.is_own_membership(old.author_id) then
      raise exception 'only the author can edit the post';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_forum_posts_guard_update
  before update on public.forum_posts
  for each row execute function public.guard_forum_post_update();

-- ------------------------------------------------------------
-- Contadores del hilo y avisos
-- ------------------------------------------------------------
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
       set reply_count = reply_count + 1, last_activity_at = new.created_at
     where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.forum_threads
       set reply_count = greatest(reply_count - 1, 0),
           last_activity_at = coalesce(
             (select max(created_at) from public.forum_posts where thread_id = old.thread_id and id <> old.id),
             created_at)
     where id = old.thread_id;
  end if;
  perform set_config('app.automation', '', true);
  return null;
end;
$$;

create trigger trg_forum_posts_counters
  after insert or delete on public.forum_posts
  for each row execute function public.forum_post_counters();

-- Respuesta nueva → avisa al autor del hilo y a quienes ya participaron
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
    if v_recipient is not null and v_recipient is distinct from new.author_id then
      perform public.notify(v_thread.org_id, v_recipient, 'forum.reply',
        public.member_name(new.author_id) || ' respondió en «' || v_thread.title || '»',
        left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
        '/app/' || v_thread.org_id || '/forum/' || v_thread.id, 'forum_thread', v_thread.id);
    end if;
  end loop;
  return null;
end;
$$;

create trigger trg_notify_forum_reply
  after insert on public.forum_posts
  for each row execute function public.notify_forum_reply();

-- Aviso nuevo → le llega a toda la empresa
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
    if v_member is distinct from new.author_id then
      perform public.notify(new.org_id, v_member, 'forum.notice', 'Nuevo aviso: ' || new.title,
        left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
        '/app/' || new.org_id || '/forum/' || new.id, 'forum_thread', new.id);
    end if;
  end loop;
  return null;
end;
$$;

create trigger trg_notify_forum_notice
  after insert on public.forum_threads
  for each row execute function public.notify_forum_notice();

create trigger trg_audit_forum_threads
  after insert or update or delete on public.forum_threads
  for each row execute function audit.log_change();
create trigger trg_audit_forum_posts
  after insert or update or delete on public.forum_posts
  for each row execute function audit.log_change();
