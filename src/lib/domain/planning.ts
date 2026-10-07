import { addDays, isWeekday, type ISODate, type Week } from "./periods";

export interface WorkloadItem {
  membership_id: string;
  estimated_hours: number;
  start_date: ISODate;
  due_date: ISODate;
}

/** Días hábiles entre dos fechas (inclusive), sin festivos. Si no hay ninguno, el último día cuenta igual. */
export function workingDays(start: ISODate, end: ISODate, holidays: ReadonlySet<ISODate> = new Set()): ISODate[] {
  const days: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) if (isWeekday(d) && !holidays.has(d)) days.push(d);
  return days.length ? days : [end];
}

/** Reparte las horas estimadas de forma pareja entre los días hábiles de la tarea. */
export function dailyHours(item: WorkloadItem, holidays: ReadonlySet<ISODate> = new Set()): Map<ISODate, number> {
  const days = workingDays(item.start_date, item.due_date, holidays);
  const perDay = item.estimated_hours / days.length;
  return new Map(days.map((d) => [d, perDay]));
}

/** Horas planificadas por persona y semana. */
export function weeklyLoad(
  items: readonly WorkloadItem[],
  weeks: readonly Week[],
  holidays: ReadonlySet<ISODate> = new Set(),
): Map<string, number[]> {
  const load = new Map<string, number[]>();
  for (const item of items) {
    const row = load.get(item.membership_id) ?? weeks.map(() => 0);
    for (const [day, hours] of dailyHours(item, holidays)) {
      const index = weeks.findIndex((w) => day >= w.start && day <= w.end);
      if (index >= 0) row[index] += hours;
    }
    load.set(item.membership_id, row);
  }
  for (const row of load.values()) row.forEach((h, i) => (row[i] = Math.round(h * 10) / 10));
  return load;
}

/**
 * Capacidad de una semana: descuenta los días fuera del rango visible (p. ej. otro mes)
 * y los días libres (vacaciones aprobadas).
 */
export function weekCapacity(
  weeklyHours: number,
  week: Week,
  from: ISODate,
  to: ISODate,
  daysOff: ReadonlySet<ISODate> = new Set(),
): number {
  const visible = workingDays(week.start > from ? week.start : from, week.end < to ? week.end : to).filter(
    (d) => isWeekday(d) && !daysOff.has(d),
  );
  return Math.round((weeklyHours / 5) * visible.length * 10) / 10;
}

/** Días hábiles cubiertos por rangos de vacaciones. */
export function daysOffFrom(ranges: readonly { start_date: ISODate; end_date: ISODate }[]): Set<ISODate> {
  const days = new Set<ISODate>();
  for (const r of ranges) for (let d = r.start_date; d <= r.end_date; d = addDays(d, 1)) if (isWeekday(d)) days.add(d);
  return days;
}

export type LoadLevel = "free" | "low" | "healthy" | "high" | "over";

export function loadLevel(planned: number, capacity: number): LoadLevel {
  if (capacity <= 0) return planned > 0 ? "over" : "free";
  const pct = planned / capacity;
  if (planned === 0) return "free";
  if (pct > 1) return "over";
  if (pct >= 0.85) return "high";
  if (pct >= 0.4) return "healthy";
  return "low";
}
