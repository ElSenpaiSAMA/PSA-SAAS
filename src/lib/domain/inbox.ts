import { daysBetween, formatRange, type ISODate } from "./periods";

// Las solicitudes de vacaciones no son un pendiente de la bandeja: se deciden en
// Vacaciones → Equipo (con el calendario a la vista) y llegan como notificación.
export type PendingKind = "invoice" | "close_work_order" | "approve_work_order" | "overdue_task" | "open_clock";

export interface PendingItem {
  /** Único por tipo + entidad */
  key: string;
  kind: PendingKind;
  title: string;
  detail: string;
  href: string;
  /** Fecha de referencia para ordenar (la más vieja primero) */
  since: ISODate;
  urgent: boolean;
  entityId: string;
}

export interface PendingInput {
  orgId: string;
  today: ISODate;
  /** OT cerradas sin facturar (solo si factura) */
  toInvoice: { id: string; title: string; period_end: ISODate; project: string }[];
  /** OT que gestiona esta persona */
  managedWorkOrders: { id: string; title: string; status: string; period_start: ISODate; period_end: ISODate; project: string }[];
  /** Tareas propias sin terminar */
  myTasks: { id: string; title: string; due_date: ISODate | null; status: string; project_id: string; project: string }[];
  /** Fichaje abierto propio (inicio ISO), si lo hay */
  openClockSince: string | null;
}

/** Lo que espera una acción de esta persona, con lo más urgente arriba. */
export function buildPending(input: PendingInput): PendingItem[] {
  const { today } = input;
  const base = "/app";
  const items: PendingItem[] = [];

  for (const w of input.toInvoice) {
    items.push({
      key: `invoice:${w.id}`,
      kind: "invoice",
      title: `Facturar ${w.title}`,
      detail: `${w.project} · cerrada, pendiente de facturación`,
      href: `${base}/work-orders/${w.id}`,
      since: w.period_end,
      urgent: daysBetween(w.period_end, today) > 15,
      entityId: w.id,
    });
  }

  for (const w of input.managedWorkOrders) {
    if ((w.status === "approved" || w.status === "in_progress") && w.period_end < today) {
      items.push({
        key: `close:${w.id}`,
        kind: "close_work_order",
        title: `Cerrar ${w.title}`,
        detail: `${w.project} · el período terminó el ${formatRange(w.period_end, w.period_end)}`,
        href: `${base}/work-orders/${w.id}`,
        since: w.period_end,
        urgent: daysBetween(w.period_end, today) > 5,
        entityId: w.id,
      });
    } else if (w.status === "draft" && w.period_start <= today) {
      items.push({
        key: `approve:${w.id}`,
        kind: "approve_work_order",
        title: `Aprobar ${w.title}`,
        detail: `${w.project} · el período ya empezó y sigue en borrador: nadie puede imputar horas`,
        href: `${base}/work-orders/${w.id}`,
        since: w.period_start,
        urgent: true,
        entityId: w.id,
      });
    }
  }

  for (const t of input.myTasks) {
    if (t.status === "done" || !t.due_date || t.due_date >= today) continue;
    const late = daysBetween(t.due_date, today);
    items.push({
      key: `task:${t.id}`,
      kind: "overdue_task",
      title: t.title,
      detail: `${t.project} · venció hace ${late} ${late === 1 ? "día" : "días"}`,
      href: `${base}/projects/${t.project_id}`,
      since: t.due_date,
      urgent: late > 3,
      entityId: t.id,
    });
  }

  if (input.openClockSince && input.openClockSince.slice(0, 10) < today) {
    items.push({
      key: "clock:open",
      kind: "open_clock",
      title: "Quedó un fichaje abierto",
      detail: `Desde el ${formatRange(input.openClockSince.slice(0, 10), input.openClockSince.slice(0, 10))}: fichá la salida o pedí una corrección`,
      href: `${base}/time-tracking`,
      since: input.openClockSince.slice(0, 10),
      urgent: true,
      entityId: "clock",
    });
  }

  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.since.localeCompare(b.since));
}

export const PENDING_LABEL: Record<PendingKind, string> = {
  invoice: "Facturación",
  close_work_order: "Orden de trabajo",
  approve_work_order: "Orden de trabajo",
  overdue_task: "Tarea vencida",
  open_clock: "Fichaje",
};
