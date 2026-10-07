import "server-only";
import { cache } from "react";
import { getEmployees } from "@/lib/data/employees";
import { displayName } from "@/lib/domain/hierarchy";
import { createClient } from "@/lib/supabase/server";
import type { ForumPost, ForumThread } from "@/lib/supabase/database.types";

export interface Author {
  id: string | null;
  name: string;
}

export type ThreadWithAuthor = ForumThread & { author: Author };
export type PostWithAuthor = ForumPost & { author: Author };

const authorNames = cache(async (orgId: string) => {
  const employees = await getEmployees(orgId);
  return new Map(employees.map((e) => [e.id, displayName(e.profile)]));
});

const withAuthor = (names: Map<string, string>, id: string | null): Author => ({
  id,
  // Si la persona ya no está en la empresa, el mensaje se conserva sin autor
  name: (id && names.get(id)) || "Ex miembro",
});

/** Hilos con actividad de otras personas desde mi última visita al foro (para el aviso del menú). */
export const getForumUnreadCount = cache(async (orgId: string): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("forum_unread_count", { p_org_id: orgId });
  return data ?? 0;
});

/** Cuándo vi el foro por última vez (o, si nunca, cuándo entré a la empresa). */
export const getForumSeenAt = cache(async (membershipId: string, joinedAt: string): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase.from("forum_reads").select("seen_at").eq("membership_id", membershipId).maybeSingle();
  return data?.seen_at ?? joinedAt;
});

/** Personas de la empresa que se pueden mencionar con @. */
export const getMentionables = cache(async (orgId: string) => {
  const employees = await getEmployees(orgId);
  return employees
    .filter((e) => e.status === "active")
    .map((e) => ({ id: e.id, name: displayName(e.profile) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
});

/** RLS: solo personas de la empresa leen el foro. */
export const getThreads = cache(async (orgId: string): Promise<ThreadWithAuthor[]> => {
  const supabase = await createClient();
  const [{ data, error }, names] = await Promise.all([
    supabase
      .from("forum_threads")
      .select("*")
      .eq("org_id", orgId)
      .order("pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(500),
    authorNames(orgId),
  ]);
  if (error) throw error;
  return (data ?? []).map((t) => ({ ...t, author: withAuthor(names, t.author_id) }));
});

export const getThread = cache(
  async (orgId: string, threadId: string): Promise<{ thread: ThreadWithAuthor; posts: PostWithAuthor[] } | null> => {
    const supabase = await createClient();
    const [thread, posts, names] = await Promise.all([
      supabase.from("forum_threads").select("*").eq("org_id", orgId).eq("id", threadId).maybeSingle(),
      supabase.from("forum_posts").select("*").eq("thread_id", threadId).order("created_at"),
      authorNames(orgId),
    ]);
    if (thread.error) throw thread.error;
    if (posts.error) throw posts.error;
    if (!thread.data) return null;
    return {
      thread: { ...thread.data, author: withAuthor(names, thread.data.author_id) },
      posts: (posts.data ?? []).map((p) => ({ ...p, author: withAuthor(names, p.author_id) })),
    };
  },
);
