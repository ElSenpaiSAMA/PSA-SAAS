// Registro horario semanal (estilo Factorial) y hoja de horas por tarea (estilo Productive).
// Funciones puras sobre fechas locales: se ejecutan en el navegador, con la zona
// horaria de quien ficha (el servidor corre en UTC).

import { startOfDay } from "./time";

export interface Entry {
  id: string;
  entry_type: "clock" | "break" | "task";
  started_at: string;
  ended_at: string | null;
  task_id?: string | null;
}

export interface Segment {
  id: string;
  kind: "work" | "break";
  /** Minutos desde las 00:00 del día */
  start: number;
  end: number;
  open: boolean;
}

export type DayStatus = "future" | "weekend" | "holiday" | "absence" | "running" | "complete" | "short" | "missing";

export interface DayRow {
  date: Date;
  segments: Segment[];
  workedMin: number;
  breakMin: number;
  expectedMin: number;
  /** Trabajado − previsto (null en días futuros) */
  balanceMin: number | null;
  status: DayStatus;
  /** Nombre del festivo o tipo de ausencia */
  note?: string;
}

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local → "2026-10-05" (para cruzar con festivos y ausencias, que son fechas sin hora). */
export function localISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Los 7 días (lunes a domingo) de la semana que empieza en `monday`. */
export function weekDays(monday: Date): Date[] {
  const start = startOfDay(monday);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Tramos de jornada y pausa de un día, recortados a ese día. */
export function daySegments(entries: readonly Entry[], day: Date, now: Date): Segment[] {
  const from = startOfDay(day).getTime();
  const to = from + DAY;
  return entries
    .filter((e) => e.entry_type !== "task")
    .flatMap((e) => {
      const s = new Date(e.started_at).getTime();
      const end = e.ended_at ? new Date(e.ended_at).getTime() : now.getTime();
      if (end <= from || s >= to) return [];
      return [
        {
          id: e.id,
          kind: e.entry_type === "break" ? ("break" as const) : ("work" as const),
          start: Math.round((Math.max(s, from) - from) / 60_000),
          end: Math.round((Math.min(end, to) - from) / 60_000),
          open: !e.ended_at,
        },
      ];
    })
    .sort((a, b) => a.start - b.start);
}

export interface DayContext {
  now: Date;
  /** Minutos previstos en un día laborable (jornada semanal / 5) */
  expectedPerDayMin: number;
  holidays: ReadonlyMap<string, string>;
  /** Ausencias aprobadas: fecha → tipo ("Vacaciones", "Baja médica"…) */
  absences: ReadonlyMap<string, string>;
}

/** Una fila del registro: tramos, totales, saldo y estado del día. */
export function dayRow(entries: readonly Entry[], day: Date, ctx: DayContext): DayRow {
  const segments = daySegments(entries, day, ctx.now);
  const sum = (kind: Segment["kind"]) => segments.filter((s) => s.kind === kind).reduce((t, s) => t + (s.end - s.start), 0);
  const workedMin = sum("work");
  const breakMin = sum("break");
  const iso = localISO(day);
  const today = startOfDay(ctx.now).getTime();
  const d = startOfDay(day).getTime();
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  const holiday = ctx.holidays.get(iso);
  const absence = ctx.absences.get(iso);
  const expectedMin = weekend || holiday || absence ? 0 : ctx.expectedPerDayMin;

  let status: DayStatus;
  let note: string | undefined;
  if (holiday) [status, note] = ["holiday", holiday];
  else if (absence) [status, note] = ["absence", absence];
  else if (d > today) status = "future";
  else if (weekend) status = workedMin > 0 ? "complete" : "weekend";
  else if (segments.some((s) => s.open)) status = "running";
  else if (workedMin === 0) status = d === today ? "future" : "missing";
  // Margen de 15 minutos antes de marcar una jornada como incompleta
  else status = workedMin >= expectedMin - 15 ? "complete" : "short";

  const past = d < today || (d === today && status !== "running" && status !== "future");
  return {
    date: day,
    segments,
    workedMin,
    breakMin,
    expectedMin,
    // Sin horas previstas ni trabajadas (fin de semana, festivo, ausencia) no hay saldo
    balanceMin: (past || workedMin > 0) && (expectedMin > 0 || workedMin > 0) ? workedMin - expectedMin : null,
    status,
    note,
  };
}

export interface WeekSummary {
  workedMin: number;
  expectedMin: number;
  /** Saldo de los días ya transcurridos */
  balanceMin: number;
  breakMin: number;
  daysWorked: number;
}

export function weekSummary(rows: readonly DayRow[]): WeekSummary {
  return rows.reduce(
    (s, r) => ({
      workedMin: s.workedMin + r.workedMin,
      expectedMin: s.expectedMin + r.expectedMin,
      balanceMin: s.balanceMin + (r.balanceMin ?? 0),
      breakMin: s.breakMin + r.breakMin,
      daysWorked: s.daysWorked + (r.workedMin > 0 ? 1 : 0),
    }),
    { workedMin: 0, expectedMin: 0, balanceMin: 0, breakMin: 0, daysWorked: 0 },
  );
}

/** Ventana horaria del gráfico (por defecto 7–20 h; se agranda si hay tramos fuera). */
export function timelineWindow(rows: readonly DayRow[]): { from: number; to: number } {
  const all = rows.flatMap((r) => r.segments);
  const from = Math.min(7 * 60, ...all.map((s) => Math.floor(s.start / 60) * 60));
  const to = Math.max(20 * 60, ...all.map((s) => Math.ceil(s.end / 60) * 60));
  return { from, to };
}

/** "+1h 30m" / "−45m" / "0m" */
export function formatBalance(min: number): string {
  if (min === 0) return "0m";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${min > 0 ? "+" : "−"}${h ? `${h}h` : ""}${h && m ? " " : ""}${m || !h ? `${m}m` : ""}`;
}

// ─────────────────────────────────────────────────────────────
// Hoja de horas por tarea (Productive)
// ─────────────────────────────────────────────────────────────

export interface TaskRow {
  taskId: string;
  /** Minutos por día, de lunes a domingo */
  perDay: number[];
  total: number;
}

export function taskGrid(entries: readonly Entry[], days: readonly Date[], now: Date): { rows: TaskRow[]; perDay: number[]; total: number } {
  const keys = days.map((d) => startOfDay(d).getTime());
  const byTask = new Map<string, number[]>();
  for (const e of entries) {
    if (e.entry_type !== "task" || !e.task_id) continue;
    const i = keys.indexOf(startOfDay(new Date(e.started_at)).getTime());
    if (i === -1) continue;
    const end = e.ended_at ? new Date(e.ended_at).getTime() : now.getTime();
    const mins = Math.max(0, Math.round((end - new Date(e.started_at).getTime()) / 60_000));
    const row = byTask.get(e.task_id) ?? days.map(() => 0);
    row[i] += mins;
    byTask.set(e.task_id, row);
  }
  const rows = [...byTask.entries()].map(([taskId, perDay]) => ({ taskId, perDay, total: perDay.reduce((a, b) => a + b, 0) }));
  const perDay = days.map((_, i) => rows.reduce((s, r) => s + r.perDay[i], 0));
  return { rows: rows.sort((a, b) => b.total - a.total), perDay, total: perDay.reduce((a, b) => a + b, 0) };
}
