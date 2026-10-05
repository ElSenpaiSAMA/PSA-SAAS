import { addDays, daysBetween, type ISODate, type Week } from "./periods";

export type CalendarEventKind = "task" | "workOrder" | "absence" | "holiday";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  start: ISODate;
  end: ISODate;
  href?: string;
  /** Datos extra según el tipo (estado, persona, etc.) */
  status?: string;
  mine?: boolean;
  /** Si el usuario puede moverlo arrastrando (tareas que gestiona) */
  movable?: boolean;
  /** Tareas: si tiene fecha de inicio propia (si no, solo se mueve el vencimiento) */
  hasStart?: boolean;
  /** Texto secundario (proyecto, persona…) */
  subtitle?: string;
}

export interface WeekSlot {
  event: CalendarEvent;
  /** Columna inicial (0 = lunes) */
  col: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Orden de prioridad para los carriles: lo puntual y personal arriba, los períodos largos al final. */
const KIND_PRIORITY: Record<CalendarEventKind, number> = { absence: 0, task: 1, workOrder: 2, holiday: 3 };

/** Ubica los eventos de una semana en carriles sin superponerse (como Google Calendar en vista mes). */
export function layoutWeek(events: readonly CalendarEvent[], week: Week): { slots: WeekSlot[]; lanes: number } {
  const inWeek = events
    .filter((e) => e.start <= week.end && e.end >= week.start)
    .sort(
      (a, b) =>
        KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
        a.start.localeCompare(b.start) ||
        daysBetween(b.start, b.end) - daysBetween(a.start, a.end),
    );

  // Intervalos de columnas ocupados en cada carril (los eventos no llegan en orden de fecha)
  const occupied: [number, number][][] = [];
  const slots: WeekSlot[] = [];
  for (const event of inWeek) {
    const start = event.start < week.start ? week.start : event.start;
    const end = event.end > week.end ? week.end : event.end;
    const col = daysBetween(week.start, start);
    const span = daysBetween(start, end) + 1;
    const last = col + span - 1;
    let lane = occupied.findIndex((intervals) => intervals.every(([a, b]) => last < a || col > b));
    if (lane === -1) lane = occupied.push([]) - 1;
    occupied[lane].push([col, last]);
    slots.push({
      event,
      col,
      span,
      lane,
      continuesBefore: event.start < week.start,
      continuesAfter: event.end > week.end,
    });
  }
  return { slots, lanes: occupied.length };
}

/** Días (lunes a domingo) de una semana. */
export function daysOfWeek(week: Week): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
}

/** Mueve un evento manteniendo su duración: nuevo inicio = inicio + delta días. */
export function shiftRange(start: ISODate, end: ISODate, deltaDays: number): { start: ISODate; end: ISODate } {
  return { start: addDays(start, deltaDays), end: addDays(end, deltaDays) };
}

/** Rango ordenado entre dos días seleccionados (en cualquier orden). */
export function orderedRange(a: ISODate, b: ISODate): { start: ISODate; end: ISODate } {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}
