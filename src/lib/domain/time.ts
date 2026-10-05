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
