import { formatMonth, nextPeriod, type ISODate } from "./periods";

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

// ── Ciclo de vida, como lo ve la persona usuaria ─────────────

export type LifecycleStep = WorkOrderStatus | "invoiced";

export const LIFECYCLE: { key: LifecycleStep; label: string; help: string }[] = [
  { key: "draft", label: "Borrador", help: "Se define el alcance: tareas, fechas y presupuesto." },
  { key: "approved", label: "Aprobada", help: "Lista para trabajar: el equipo ya puede imputar horas." },
  { key: "in_progress", label: "En curso", help: "Se está trabajando. Pasa sola a este estado con la primera hora imputada." },
  { key: "closed", label: "Cerrada", help: "Trabajo terminado: ya no admite horas." },
  { key: "invoiced", label: "Facturada", help: "Facturada al cliente. Queda bloqueada." },
];

export function lifecycleIndex(status: WorkOrderStatus, billing: BillingStatus): number {
  if (billing === "invoiced") return LIFECYCLE.length - 1;
  return LIFECYCLE.findIndex((s) => s.key === status);
}

export interface NextStep {
  /** Estado al que lleva la acción, o "invoiced" para facturar */
  target: LifecycleStep;
  label: string;
  description: string;
  /** false si el paso existe pero no lo puede dar este usuario */
  allowed: boolean;
}

/** Acción principal recomendada según el estado (una sola, para guiar el flujo). */
export function nextStep(
  status: WorkOrderStatus,
  billing: BillingStatus,
  can: { manage: boolean; bill: boolean },
): NextStep | null {
  if (billing === "invoiced") return null;
  switch (status) {
    case "draft":
      return {
        target: "approved",
        label: "Aprobar OT",
        description: "Cuando el alcance esté definido, aprobala para que el equipo pueda empezar a imputar horas.",
        allowed: can.manage,
      };
    case "approved":
      return {
        target: "in_progress",
        label: "Marcar en curso",
        description: "Pasa sola a «En curso» con la primera hora imputada. También podés marcarla a mano.",
        allowed: can.manage,
      };
    case "in_progress":
      return {
        target: "closed",
        label: "Cerrar OT",
        description: "Cerrala cuando el trabajo del período esté terminado. Después ya no admite horas.",
        allowed: can.manage,
      };
    case "closed":
      return {
        target: "invoiced",
        label: "Marcar como facturada",
        description: can.bill
          ? "Registrá que se facturó al cliente. La OT y sus tareas quedan bloqueadas."
          : "Pendiente de facturación por un administrador.",
        allowed: can.bill,
      };
  }
}

/** Acciones para retroceder un paso (secundarias). */
export function secondarySteps(
  status: WorkOrderStatus,
  billing: BillingStatus,
  can: { manage: boolean; bill: boolean },
): { target: LifecycleStep | "unbilled"; label: string }[] {
  if (billing === "invoiced") return can.bill ? [{ target: "unbilled", label: "Revertir facturación" }] : [];
  if (!can.manage) return [];
  if (status === "approved") return [{ target: "draft", label: "Volver a borrador" }];
  if (status === "closed") return [{ target: "in_progress", label: "Reabrir" }];
  return [];
}

export type WorkOrderFilter = "all" | "draft" | "active" | "to_invoice" | "invoiced";

export const FILTERS: { key: WorkOrderFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "draft", label: "Borrador" },
  { key: "active", label: "En curso" },
  { key: "to_invoice", label: "Por facturar" },
  { key: "invoiced", label: "Facturadas" },
];

export function matchesFilter(filter: WorkOrderFilter, status: WorkOrderStatus, billing: BillingStatus): boolean {
  switch (filter) {
    case "all":
      return true;
    case "draft":
      return status === "draft";
    case "active":
      return status === "approved" || status === "in_progress";
    case "to_invoice":
      return status === "closed" && billing === "unbilled";
    case "invoiced":
      return billing === "invoiced";
  }
}

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

/**
 * OT del mes anterior que todavía no tienen continuación en `month`:
 * su proyecto no tiene ninguna OT que empiece en ese mes.
 */
export function missingContinuations<T extends { project_id: string; period_start: ISODate }>(
  previous: T[],
  current: { project_id: string; period_start: ISODate }[],
  month: ISODate,
): T[] {
  const covered = new Set(current.filter((w) => w.period_start.slice(0, 7) === month.slice(0, 7)).map((w) => w.project_id));
  return previous.filter((w) => !covered.has(w.project_id));
}

/** La OT del mismo proyecto que empieza en el período siguiente a `wo`, si existe. */
export function findContinuation<T extends { id: string; project_id: string; period_start: ISODate; period_end: ISODate }>(
  wo: T,
  candidates: T[],
): T | undefined {
  const nextMonth = nextPeriod(wo.period_start, wo.period_end).start.slice(0, 7);
  return candidates.find((c) => c.id !== wo.id && c.project_id === wo.project_id && c.period_start.slice(0, 7) === nextMonth);
}
