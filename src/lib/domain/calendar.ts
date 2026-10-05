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

/** Ubica los eventos de una semana en carriles sin superponerse (como Google Calendar en vista mes). */
export function layoutWeek(events: readonly CalendarEvent[], week: Week): { slots: WeekSlot[]; lanes: number } {
  const inWeek = events
    .filter((e) => e.start <= week.end && e.end >= week.start)
    .sort((a, b) => a.start.localeCompare(b.start) || daysBetween(b.start, b.end) - daysBetween(a.start, a.end));

  const laneEnds: number[] = []; // última columna ocupada por carril
  const slots: WeekSlot[] = [];
  for (const event of inWeek) {
    const start = event.start < week.start ? week.start : event.start;
    const end = event.end > week.end ? week.end : event.end;
    const col = daysBetween(week.start, start);
    const span = daysBetween(start, end) + 1;
    let lane = laneEnds.findIndex((last) => last < col);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = col + span - 1;
    slots.push({
      event,
      col,
      span,
      lane,
      continuesBefore: event.start < week.start,
      continuesAfter: event.end > week.end,
    });
  }
  return { slots, lanes: laneEnds.length };
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
