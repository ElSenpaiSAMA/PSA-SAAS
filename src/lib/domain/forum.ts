import type { ForumCategory } from "@/lib/supabase/database.types";

// Foro interno. La base es la fuente de verdad (RLS + guards); esto decide qué
// mostrar y cómo ordenar/filtrar la lista de hilos.

export const FORUM_CATEGORIES: { value: ForumCategory; label: string; hint: string }[] = [
  { value: "question", label: "Duda", hint: "Preguntá al equipo: materiales, procedimientos, herramientas." },
  { value: "incident", label: "Incidencia técnica", hint: "Una avería o un problema en un barco o en el taller." },
  { value: "notice", label: "Aviso", hint: "Le llega a toda la empresa como notificación." },
];

export const CATEGORY_LABEL: Record<ForumCategory, string> = Object.fromEntries(FORUM_CATEGORIES.map((c) => [c.value, c.label])) as Record<
  ForumCategory,
  string
>;

export function isForumCategory(value: unknown): value is ForumCategory {
  return FORUM_CATEGORIES.some((c) => c.value === value);
}

export interface ThreadSummary {
  id: string;
  category: ForumCategory;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  resolved: boolean;
  last_activity_at: string;
}

export type ThreadStatusFilter = "all" | "open" | "resolved";

export interface ThreadFilter {
  category?: ForumCategory | null;
  status?: ThreadStatusFilter;
  query?: string;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Fijados primero; después, los que tuvieron actividad más reciente. */
export function sortThreads<T extends ThreadSummary>(threads: readonly T[]): T[] {
  return [...threads].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.last_activity_at.localeCompare(a.last_activity_at));
}

/** Filtra por categoría, estado (solo aplica a incidencias y dudas) y texto (sin tildes ni mayúsculas). */
export function filterThreads<T extends ThreadSummary>(threads: readonly T[], { category, status = "all", query }: ThreadFilter): T[] {
  const words = normalize(query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return threads.filter((t) => {
    if (category && t.category !== category) return false;
    if (status === "resolved" && !t.resolved) return false;
    if (status === "open" && (t.resolved || t.category === "notice")) return false;
    if (words.length) {
      const text = normalize(`${t.title} ${t.body}`);
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
}

export interface ThreadAbilities {
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Fijar y cerrar */
  canModerate: boolean;
  /** Marcar como resuelto (dudas e incidencias) */
  canResolve: boolean;
}

/** Qué puede hacer la persona actual con un hilo. Espejo de las políticas de la base. */
export function threadAbilities(
  thread: { category: ForumCategory; locked: boolean },
  { isAuthor, isModerator }: { isAuthor: boolean; isModerator: boolean },
): ThreadAbilities {
  return {
    canReply: !thread.locked || isModerator,
    canEdit: isAuthor,
    canDelete: isAuthor || isModerator,
    canModerate: isModerator,
    canResolve: thread.category !== "notice" && (isAuthor || isModerator),
  };
}

/** Primeras líneas del cuerpo para la lista de hilos. */
export function excerpt(body: string, max = 160): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export interface PostNode<T> {
  post: T;
  children: PostNode<T>[];
  /** Respuestas que cuelgan de esta, en total (hijas, nietas…) */
  descendants: number;
}

/**
 * Arma el árbol de respuestas de un hilo. Las respuestas sin madre (o cuya madre
 * ya no está) van al primer nivel; dentro de cada nivel, en orden cronológico.
 */
export function buildPostTree<T extends { id: string; parent_id: string | null; created_at: string }>(posts: readonly T[]): PostNode<T>[] {
  const nodes = new Map(posts.map((p) => [p.id, { post: p, children: [] as PostNode<T>[], descendants: 0 }]));
  const roots: PostNode<T>[] = [];
  const sorted = [...posts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const p of sorted) {
    const node = nodes.get(p.id)!;
    const parent = p.parent_id ? nodes.get(p.parent_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const count = (n: PostNode<T>): number => (n.descendants = n.children.reduce((s, c) => s + 1 + count(c), 0));
  roots.forEach(count);
  return roots;
}

export interface Participant {
  id: string | null;
  name: string;
  /** Respuestas que dejó en el hilo */
  replies: number;
  isAuthor: boolean;
}

/**
 * Quiénes participan en un hilo: el autor primero y después cada persona en el orden
 * en que respondió, sin repetir. Quien ya no está en la empresa (id nulo) no se cuenta.
 */
export function threadParticipants(
  author: { id: string | null; name: string },
  posts: readonly { author_id: string | null; author: string; created_at: string }[],
): Participant[] {
  const byId = new Map<string, Participant>();
  if (author.id) byId.set(author.id, { id: author.id, name: author.name, replies: 0, isAuthor: true });
  for (const p of [...posts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!p.author_id) continue;
    const current = byId.get(p.author_id);
    if (current) current.replies += 1;
    else byId.set(p.author_id, { id: p.author_id, name: p.author, replies: 1, isAuthor: false });
  }
  return [...byId.values()];
}

/**
 * Otros hilos para seguir leyendo: primero los de la misma categoría y, si no alcanzan,
 * los más recientes del foro. Nunca el hilo actual.
 */
export function relatedThreads<T extends ThreadSummary>(
  threads: readonly T[],
  current: { id: string; category: ForumCategory },
  limit = 4,
): T[] {
  const others = [...threads].filter((t) => t.id !== current.id).sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
  const same = others.filter((t) => t.category === current.category);
  const rest = others.filter((t) => t.category !== current.category);
  return [...same, ...rest].slice(0, limit);
}
