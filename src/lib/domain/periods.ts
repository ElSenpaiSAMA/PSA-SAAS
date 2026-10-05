// Fechas como strings ISO "YYYY-MM-DD" (date de Postgres): sin horas ni zonas horarias.

export type ISODate = string;

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toParts(iso: ISODate) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function fromUTC(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

function utc(iso: ISODate) {
  const { y, m, d } = toParts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

export function monthStart(iso: ISODate): ISODate {
  const { y, m } = toParts(iso);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function monthEnd(iso: ISODate): ISODate {
  const { y, m } = toParts(iso);
  return fromUTC(new Date(Date.UTC(y, m, 0)));
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const { y, m } = toParts(monthStart(iso));
  return fromUTC(new Date(Date.UTC(y, m - 1 + months, 1)));
}

/** "Octubre 2026" */
export function formatMonth(iso: ISODate): string {
  const { y, m } = toParts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10" → primer día del mes; inválido → null */
export function parseMonthParam(value: unknown): ISODate | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return `${value}-01`;
}

export function toMonthParam(iso: ISODate): string {
  return iso.slice(0, 7);
}

/** "3 – 14 oct" / "28 sep – 2 oct" */
export function formatRange(start: ISODate, end: ISODate): string {
  const short = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const a = toParts(start);
  const b = toParts(end);
  if (start === end) return `${a.d} ${short[a.m - 1]}`;
  if (a.m === b.m && a.y === b.y) return `${a.d} – ${b.d} ${short[b.m - 1]}`;
  return `${a.d} ${short[a.m - 1]} – ${b.d} ${short[b.m - 1]}`;
}

export function overlaps(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** El mismo período corrido un mes (para "copiar al mes siguiente"); un mes completo sigue siendo un mes completo. */
export function nextPeriod(start: ISODate, end: ISODate): { start: ISODate; end: ISODate } {
  const isFullMonth = start === monthStart(start) && end === monthEnd(start);
  if (isFullMonth) {
    const next = addMonths(start, 1);
    return { start: next, end: monthEnd(next) };
  }
  const length = daysBetween(start, end);
  const nextStart = addMonths(start, 1);
  return { start: nextStart, end: addDays(nextStart, length) };
}

export interface Week {
  start: ISODate; // lunes
  end: ISODate; // domingo
}

/** Semanas (lunes a domingo) que tocan el mes. */
export function weeksOfMonth(iso: ISODate): Week[] {
  const first = monthStart(iso);
  const last = monthEnd(iso);
  const dow = (utc(first).getUTCDay() + 6) % 7; // 0 = lunes
  const weeks: Week[] = [];
  for (let start = addDays(first, -dow); start <= last; start = addDays(start, 7)) {
    weeks.push({ start, end: addDays(start, 6) });
  }
  return weeks;
}

export function isWeekday(iso: ISODate): boolean {
  const day = utc(iso).getUTCDay();
  return day !== 0 && day !== 6;
}

export function todayISO(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
