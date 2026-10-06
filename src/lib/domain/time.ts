export interface TimeSpan {
  started_at: string;
  ended_at: string | null;
}

const MINUTE = 60_000;

export function entryMinutes(entry: TimeSpan, now: Date = new Date()): number {
  const start = new Date(entry.started_at).getTime();
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.floor((end - start) / MINUTE));
}

export function totalMinutes(entries: readonly TimeSpan[], now: Date = new Date()): number {
  return entries.reduce((sum, e) => sum + entryMinutes(e, now), 0);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** Porcentaje de la capacidad semanal consumida (puede superar 100 = sobrecarga). */
export function workloadPercent(loggedMinutes: number, weeklyHours: number): number {
  if (weeklyHours <= 0) return 0;
  return Math.round((loggedMinutes / (weeklyHours * 60)) * 100);
}

export type WorkloadLevel = "low" | "healthy" | "high" | "overloaded";

export function workloadLevel(percent: number): WorkloadLevel {
  if (percent > 100) return "overloaded";
  if (percent >= 85) return "high";
  if (percent >= 40) return "healthy";
  return "low";
}

/** Lunes 00:00 (hora local) de la semana de `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function findOpenEntry<T extends TimeSpan>(entries: readonly T[]): T | undefined {
  return entries.find((e) => e.ended_at === null);
}

export type EntryKind = "clock" | "break" | "task";

export type ClockState =
  | { status: "off" }
  | { status: "working"; since: string }
  | { status: "paused"; since: string };

/** Estado del fichaje según los tramos abiertos: trabajando, en pausa o fuera de jornada. */
export function clockState(entries: readonly (TimeSpan & { entry_type: EntryKind })[]): ClockState {
  const open = entries.find((e) => e.ended_at === null && e.entry_type !== "task");
  if (!open) return { status: "off" };
  return open.entry_type === "break" ? { status: "paused", since: open.started_at } : { status: "working", since: open.started_at };
}

/** Minutos de tramos cerrados de un tipo (el tramo abierto lo suma el cliente en vivo). */
export function closedMinutes(entries: readonly (TimeSpan & { entry_type: EntryKind })[], kind: EntryKind): number {
  return entries.filter((e) => e.entry_type === kind && e.ended_at !== null).reduce((s, e) => s + entryMinutes(e), 0);
}

export interface DayTotals {
  date: Date;
  clockMinutes: number;
  taskMinutes: number;
  breakMinutes: number;
}

/** Totales por día (lunes a domingo, hora local) de la semana que empieza en `weekStart`. */
export function weekTotals(
  entries: readonly (TimeSpan & { entry_type: EntryKind })[],
  weekStart: Date,
  now: Date = new Date(),
): DayTotals[] {
  const days: DayTotals[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return { date, clockMinutes: 0, taskMinutes: 0, breakMinutes: 0 };
  });
  for (const e of entries) {
    const index = Math.floor((startOfDay(new Date(e.started_at)).getTime() - weekStart.getTime()) / 86_400_000);
    const day = days[index];
    if (!day) continue;
    if (e.entry_type === "clock") day.clockMinutes += entryMinutes(e, now);
    else if (e.entry_type === "break") day.breakMinutes += entryMinutes(e, now);
    else day.taskMinutes += entryMinutes(e, now);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
