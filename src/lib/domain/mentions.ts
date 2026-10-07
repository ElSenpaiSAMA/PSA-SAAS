// Menciones con @ en el foro. El texto se guarda tal cual ("@Ana Torres ¿lo ves?")
// y aparte la lista de personas mencionadas, que es lo que decide a quién avisar.

export interface Mentionable {
  id: string;
  name: string;
}

export type MentionChunk = { type: "text"; text: string } | { type: "mention"; text: string; id: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Parte el texto en tramos de texto y de menciones (solo las personas indicadas, el nombre más largo primero). */
export function splitMentions(body: string, people: readonly Mentionable[]): MentionChunk[] {
  const named = people.filter((p) => p.name.trim()).sort((a, b) => b.name.length - a.name.length);
  if (named.length === 0) return [{ type: "text", text: body }];
  const byName = new Map(named.map((p) => [p.name.toLowerCase(), p.id]));
  // Un @ al principio o después de un espacio/puntuación, seguido de un nombre completo
  const re = new RegExp(`(^|[\\s(¿¡,;:])@(${named.map((p) => escape(p.name)).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const chunks: MentionChunk[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    const start = m.index! + m[1].length;
    if (start > last) chunks.push({ type: "text", text: body.slice(last, start) });
    chunks.push({ type: "mention", text: `@${m[2]}`, id: byName.get(m[2].toLowerCase())! });
    last = start + m[2].length + 1;
  }
  if (last < body.length) chunks.push({ type: "text", text: body.slice(last) });
  return chunks;
}

/** Ids de las personas que siguen mencionadas en el texto (por si se borró una mención después de elegirla). */
export function mentionedIds(body: string, people: readonly Mentionable[]): string[] {
  return [...new Set(splitMentions(body, people).flatMap((c) => (c.type === "mention" ? [c.id] : [])))];
}

/** Si el cursor está terminando de escribir "@algo", devuelve qué se busca y dónde empieza el @. */
export function mentionQueryAt(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = /(^|[\s(¿¡,;:])@([\p{L}\p{N}]*(?: [\p{L}\p{N}]*)?)$/u.exec(before);
  if (!m) return null;
  return { query: m[2], start: before.length - m[2].length - 1 };
}

/** Personas que coinciden con lo escrito tras el @ (por cualquier palabra del nombre, sin tildes). */
export function suggestMentions(query: string, people: readonly Mentionable[], limit = 6): Mentionable[] {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const q = norm(query.trim());
  return people
    .filter((p) => !q || norm(p.name).split(/\s+/).some((w) => w.startsWith(q)) || norm(p.name).startsWith(q))
    .slice(0, limit);
}
