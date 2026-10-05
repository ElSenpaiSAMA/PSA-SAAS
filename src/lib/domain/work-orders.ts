import { formatMonth, type ISODate } from "./periods";

export const WORK_ORDER_STATUSES = ["draft", "approved", "in_progress", "closed"] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type BillingStatus = "unbilled" | "invoiced";

export const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  draft: "Borrador",
  approved: "Aprobada",
  in_progress: "En curso",
  closed: "Cerrada",
};

export function workOrderCode(number: number): string {
  return `OT-${String(number).padStart(4, "0")}`;
}

/** Transiciones que ofrece la UI (la base valida facturación y bloqueo). */
export function nextStatuses(status: WorkOrderStatus, billing: BillingStatus): WorkOrderStatus[] {
  if (billing === "invoiced") return [];
  switch (status) {
    case "draft":
      return ["approved"];
    case "approved":
      return ["draft", "in_progress"];
    case "in_progress":
      return ["closed"];
    case "closed":
      return ["in_progress"];
  }
}

export const TRANSITION_LABEL: Record<WorkOrderStatus, string> = {
  draft: "Volver a borrador",
  approved: "Aprobar",
  in_progress: "Reabrir",
  closed: "Cerrar OT",
};

export function acceptsTimeEntries(status: WorkOrderStatus): boolean {
  return status === "approved" || status === "in_progress";
}

export function canInvoice(status: WorkOrderStatus, billing: BillingStatus): boolean {
  return status === "closed" && billing === "unbilled";
}

export interface WorkOrderFigures {
  budgetedHours: number | null;
  loggedHours: number;
  hourlyRate: number | null;
}

export interface WorkOrderAmounts {
  /** % de horas consumidas sobre presupuesto (null si no hay presupuesto) */
  consumption: number | null;
  remainingHours: number | null;
  budgetAmount: number | null;
  actualAmount: number | null;
}

export function workOrderAmounts({ budgetedHours, loggedHours, hourlyRate }: WorkOrderFigures): WorkOrderAmounts {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    consumption: budgetedHours ? Math.round((loggedHours / budgetedHours) * 100) : null,
    remainingHours: budgetedHours !== null ? round2(budgetedHours - loggedHours) : null,
    budgetAmount: hourlyRate !== null && budgetedHours !== null ? round2(budgetedHours * hourlyRate) : null,
    actualAmount: hourlyRate !== null ? round2(loggedHours * hourlyRate) : null,
  };
}

/** Título para la copia en otro período: reemplaza el mes si aparece, si no lo agrega. */
export function titleForPeriod(title: string, oldStart: ISODate, newStart: ISODate): string {
  const oldMonth = formatMonth(oldStart);
  const newMonth = formatMonth(newStart);
  if (title.includes(oldMonth)) return title.replace(oldMonth, newMonth);
  const base = title.replace(/\s·\s[^·]+\d{4}$/, "");
  return `${base} · ${newMonth}`;
}

export function formatMoney(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}
