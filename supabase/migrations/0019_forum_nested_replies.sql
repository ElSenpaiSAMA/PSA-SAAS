-- ============================================================
-- 0019 · Foro: respuestas anidadas
--
-- Una respuesta puede contestar a otra respuesta (parent_id). La base
-- valida que la respuesta "madre" sea del mismo hilo y no deja cambiarla
-- después. Si se borra una respuesta, las que la contestaban no se pierden:
-- quedan como respuestas directas al hilo.
-- ============================================================

alter table public.forum_posts
  add column parent_id uuid references public.forum_posts (id) on delete set null;

create index forum_posts_parent_idx on public.forum_posts (parent_id);

create or replace function public.guard_forum_post_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- El borrado de la madre pone parent_id en null (on delete set null): eso sí se permite
    if new.parent_id is distinct from old.parent_id and new.parent_id is not null then
      raise exception 'reply parent is immutable';
    end if;
    return new;
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.forum_posts p where p.id = new.parent_id and p.thread_id = new.thread_id
  ) then
    raise exception 'parent post belongs to another thread';
  end if;
  return new;
end;
$$;

create trigger trg_forum_posts_parent
  before insert or update on public.forum_posts
  for each row execute function public.guard_forum_post_parent();
