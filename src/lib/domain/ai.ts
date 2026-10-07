// Lógica pura alrededor de la IA: nada acá llama al modelo. Interpreta y valida lo
// que el modelo devuelve, para no confiar ciegamente en su salida.

/** Extrae el primer objeto o array JSON de un texto (tolera ```json … ``` y texto alrededor). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface AllocationTask {
  id: string;
  title: string;
}

export interface AllocationItem {
  taskId: string;
  title: string;
  hours: number;
  reason: string;
}

/** Redondea a cuartos de hora (las horas se imputan en fracciones de 15 minutos). */
export const toQuarter = (h: number) => Math.round(h * 4) / 4;

/**
 * Valida la propuesta de reparto del modelo:
 * - solo tareas que existen y están abiertas para la persona;
 * - horas positivas, en cuartos de hora, sin repetir tareas;
 * - el total nunca supera lo trabajado (si se pasa, se escala hacia abajo).
 */
export function parseAllocation(raw: unknown, tasks: readonly AllocationTask[], workedHours: number): AllocationItem[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const items: AllocationItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const taskId = String(e.taskId ?? e.task_id ?? "");
    const hours = Number(e.hours);
    const task = byId.get(taskId);
    if (!task || seen.has(taskId) || !Number.isFinite(hours) || hours <= 0) continue;
    seen.add(taskId);
    items.push({ taskId, title: task.title, hours, reason: typeof e.reason === "string" ? e.reason.slice(0, 160) : "" });
  }
  const total = items.reduce((s, i) => s + i.hours, 0);
  const factor = total > workedHours && total > 0 ? workedHours / total : 1;
  return items
    .map((i) => ({ ...i, hours: toQuarter(i.hours * factor) }))
    .filter((i) => i.hours >= 0.25);
}

/** Recorta listas largas antes de mandarlas al modelo (menos costo y menos ruido). */
export function capList<T>(items: readonly T[], max: number): { items: T[]; omitted: number } {
  return { items: items.slice(0, max), omitted: Math.max(0, items.length - max) };
}

/** Texto del modelo → bloques simples para mostrar (párrafos y listas con "-" o "•"). */
export type AnswerBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

export function toBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const chunk of text.trim().split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^([-•*]|\d+[.)])\s+/.test(l))) {
      blocks.push({ type: "ul", items: lines.map((l) => l.replace(/^([-•*]|\d+[.)])\s+/, "").replace(/\*\*/g, "")) });
    } else if (lines.length) {
      blocks.push({ type: "p", text: lines.join(" ").replace(/\*\*/g, "") });
    }
  }
  return blocks;
}
