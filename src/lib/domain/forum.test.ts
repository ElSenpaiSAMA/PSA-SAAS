import { describe, expect, it } from "vitest";
import {
  buildPostTree,
  excerpt,
  filterThreads,
  relatedThreads,
  sortThreads,
  threadAbilities,
  threadParticipants,
  type ThreadSummary,
} from "./forum";

const thread = (id: string, over: Partial<ThreadSummary> = {}): ThreadSummary => ({
  id,
  category: "question",
  title: `Hilo ${id}`,
  body: "",
  pinned: false,
  locked: false,
  resolved: false,
  last_activity_at: "2026-10-01T10:00:00Z",
  ...over,
});

describe("orden de hilos", () => {
  it("pone los fijados arriba y después por última actividad", () => {
    const sorted = sortThreads([
      thread("viejo", { last_activity_at: "2026-09-01T10:00:00Z" }),
      thread("fijado", { pinned: true, last_activity_at: "2026-08-01T10:00:00Z" }),
      thread("nuevo", { last_activity_at: "2026-10-05T10:00:00Z" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["fijado", "nuevo", "viejo"]);
  });
});

describe("filtros de hilos", () => {
  const threads = [
    thread("plotter", { category: "incident", title: "Plotter Garmin se reinicia", resolved: true }),
    thread("sellador", { category: "question", title: "Sellador para pasacascos", body: "Sikaflex bajo la flotación" }),
    thread("varadero", { category: "notice", title: "Protocolo de seguridad en el varadero" }),
  ];

  it("por categoría", () => {
    expect(filterThreads(threads, { category: "incident" }).map((t) => t.id)).toEqual(["plotter"]);
  });

  it("abiertos excluye resueltos y avisos; resueltos solo los resueltos", () => {
    expect(filterThreads(threads, { status: "open" }).map((t) => t.id)).toEqual(["sellador"]);
    expect(filterThreads(threads, { status: "resolved" }).map((t) => t.id)).toEqual(["plotter"]);
  });

  it("busca en título y cuerpo, sin tildes ni mayúsculas, con todas las palabras", () => {
    expect(filterThreads(threads, { query: "FLOTACION sika" }).map((t) => t.id)).toEqual(["sellador"]);
    expect(filterThreads(threads, { query: "garmin varadero" })).toEqual([]);
  });
});

describe("permisos sobre un hilo", () => {
  it("en un hilo cerrado solo responde moderación", () => {
    const locked = { category: "incident" as const, locked: true };
    expect(threadAbilities(locked, { isAuthor: true, isModerator: false }).canReply).toBe(false);
    expect(threadAbilities(locked, { isAuthor: false, isModerator: true }).canReply).toBe(true);
  });

  it("el autor edita y resuelve; moderación fija, cierra y borra pero no edita lo ajeno", () => {
    const t = { category: "question" as const, locked: false };
    expect(threadAbilities(t, { isAuthor: true, isModerator: false })).toEqual({
      canReply: true,
      canEdit: true,
      canDelete: true,
      canModerate: false,
      canResolve: true,
    });
    expect(threadAbilities(t, { isAuthor: false, isModerator: true })).toMatchObject({
      canEdit: false,
      canDelete: true,
      canModerate: true,
    });
    expect(threadAbilities(t, { isAuthor: false, isModerator: false })).toMatchObject({
      canEdit: false,
      canDelete: false,
      canResolve: false,
    });
  });

  it("los avisos no se marcan como resueltos", () => {
    expect(threadAbilities({ category: "notice", locked: false }, { isAuthor: true, isModerator: true }).canResolve).toBe(false);
  });
});

describe("extracto", () => {
  it("aplana saltos de línea y corta con puntos suspensivos", () => {
    expect(excerpt("Hola\n\n  equipo", 50)).toBe("Hola equipo");
    expect(excerpt("a".repeat(20), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("árbol de respuestas", () => {
  const post = (id: string, parent_id: string | null, minute: number) => ({
    id,
    parent_id,
    created_at: `2026-10-07T10:${String(minute).padStart(2, "0")}:00Z`,
  });

  it("cuelga cada respuesta de su madre, en orden, y cuenta las descendientes", () => {
    const tree = buildPostTree([post("c", "a", 3), post("a", null, 1), post("b", null, 2), post("d", "c", 4)]);
    expect(tree.map((n) => n.post.id)).toEqual(["a", "b"]);
    expect(tree[0].children[0].post.id).toBe("c");
    expect(tree[0].children[0].children[0].post.id).toBe("d");
    expect(tree[0].descendants).toBe(2);
    expect(tree[1].descendants).toBe(0);
  });

  it("si la madre ya no está, la respuesta va al primer nivel", () => {
    expect(buildPostTree([post("x", "borrada", 1)]).map((n) => n.post.id)).toEqual(["x"]);
  });
});

describe("threadParticipants", () => {
  const reply = (author_id: string | null, author: string, min: number) => ({
    author_id,
    author,
    created_at: new Date(Date.UTC(2026, 0, 1, 10, min)).toISOString(),
  });

  it("el autor primero y cada persona una sola vez, en el orden en que respondió", () => {
    const people = threadParticipants({ id: "sofia", name: "Sofía" }, [
      reply("diego", "Diego", 5),
      reply("ana", "Ana", 2),
      reply("sofia", "Sofía", 7),
      reply("ana", "Ana", 9),
    ]);
    expect(people.map((p) => [p.name, p.replies, p.isAuthor])).toEqual([
      ["Sofía", 1, true],
      ["Ana", 2, false],
      ["Diego", 1, false],
    ]);
  });

  it("no cuenta a quien ya no está en la empresa", () => {
    expect(threadParticipants({ id: null, name: "Ex miembro" }, [reply(null, "Ex miembro", 1)])).toEqual([]);
  });
});

describe("relatedThreads", () => {
  const threads = [
    thread("actual", { category: "notice" }),
    thread("duda-reciente", { category: "question", last_activity_at: "2026-01-05T00:00:00Z" }),
    thread("aviso-viejo", { category: "notice", last_activity_at: "2026-01-01T00:00:00Z" }),
    thread("aviso-nuevo", { category: "notice", last_activity_at: "2026-01-03T00:00:00Z" }),
  ];

  it("primero la misma categoría (más reciente arriba), después el resto, sin el hilo actual", () => {
    expect(relatedThreads(threads, { id: "actual", category: "notice" }).map((t) => t.id)).toEqual([
      "aviso-nuevo",
      "aviso-viejo",
      "duda-reciente",
    ]);
  });

  it("respeta el límite", () => {
    expect(relatedThreads(threads, { id: "actual", category: "notice" }, 1).map((t) => t.id)).toEqual(["aviso-nuevo"]);
  });
});
