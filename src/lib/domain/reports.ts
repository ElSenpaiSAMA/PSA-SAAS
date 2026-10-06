import { businessDays, countsAgainstBalance, type AbsenceKind } from "./vacations";
import { addDays, isWeekday, type ISODate } from "./periods";
import { workOrderAmounts, workOrderCode } from "./work-orders";

// Informes del mes. Funciones puras: reciben los datos ya filtrados por permisos
// (RLS) y devuelven filas listas para mostrar y exportar.

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────
// Facturación
// ─────────────────────────────────────────────────────────────

export interface BillingRow {
  client: string;
  project: string;
  code: string;
  workOrder: string;
  status: string;
  billing: "unbilled" | "invoiced";
  budgetedHours: number | null;
  loggedHours: number;
  hourlyRate: number | null;
  amount: number;
  budgetAmount: number | null;
}

export interface BillingInput {
  workOrders: {
    id: string;
    number: number;
    title: string;
    project_id: string;
    status: string;
    billing_status: "unbilled" | "invoiced";
    budgeted_hours: number | null;
    hourly_rate: number | null;
  }[];
  projects: { id: string; name: string; client_name: string | null }[];
  /** Minutos imputados por OT */
  minutesByWorkOrder: Map<string, number>;
}

const STATUS_TEXT: Record<string, string> = { draft: "Borrador", approved: "Aprobada", in_progress: "En curso", closed: "Cerrada" };

/** Una fila por OT del período, ordenadas por cliente y proyecto. Sin tarifa = interna (importe 0). */
export function billingReport({ workOrders, projects, minutesByWorkOrder }: BillingInput) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const rows: BillingRow[] = workOrders
    .map((w) => {
      const p = byId.get(w.project_id);
      const logged = (minutesByWorkOrder.get(w.id) ?? 0) / 60;
      const amounts = workOrderAmounts({ budgetedHours: w.budgeted_hours, loggedHours: logged, hourlyRate: w.hourly_rate });
      return {
        client: p?.client_name ?? "Interno",
        project: p?.name ?? "Proyecto",
        code: workOrderCode(w.number),
        workOrder: w.title,
        status: STATUS_TEXT[w.status] ?? w.status,
        billing: w.billing_status,
        budgetedHours: w.budgeted_hours,
        loggedHours: round2(logged),
        hourlyRate: w.hourly_rate,
        amount: amounts.actualAmount ?? 0,
        budgetAmount: amounts.budgetAmount,
      };
    })
    .sort((a, b) => a.client.localeCompare(b.client, "es") || a.project.localeCompare(b.project, "es") || a.code.localeCompare(b.code));

  const sum = (filter: (r: BillingRow) => boolean) => round2(rows.filter(filter).reduce((s, r) => s + r.amount, 0));
  return {
    rows,
    totals: {
      hours: round2(rows.reduce((s, r) => s + r.loggedHours, 0)),
      amount: sum(() => true),
      invoiced: sum((r) => r.billing === "invoiced"),
      // Lo cerrado sin facturar es lo que hay que facturar ya; lo abierto, lo que viene
      toInvoice: sum((r) => r.billing === "unbilled" && r.status === STATUS_TEXT.closed),
      inProgress: sum((r) => r.billing === "unbilled" && r.status !== STATUS_TEXT.closed),
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Horas por persona y proyecto
// ─────────────────────────────────────────────────────────────

export interface HoursRow {
  memberId: string;
  name: string;
  clockHours: number;
  taskHours: number;
  capacityHours: number;
  /** % de la capacidad imputado a proyectos */
  utilization: number | null;
  byProject: Record<string, number>;
}

export interface HoursInput {
  members: { id: string; name: string; weeklyHours: number }[];
  entries: { membership_id: string; entry_type: string; task_id: string | null; started_at: string; ended_at: string | null }[];
  /** Proyecto de cada tarea */
  taskProject: Map<string, string>;
  /** Días hábiles del período (sin fines de semana ni festivos) */
  workingDays: number;
}

const hoursOf = (e: { started_at: string; ended_at: string | null }) =>
  e.ended_at ? Math.max(0, (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 3_600_000) : 0;

/** Horas fichadas e imputadas por persona, desglosadas por proyecto, contra su capacidad. */
export function hoursReport({ members, entries, taskProject, workingDays }: HoursInput) {
  const projectIds = new Set<string>();
  const rows: HoursRow[] = members.map((m) => {
    const own = entries.filter((e) => e.membership_id === m.id && e.ended_at);
    const byProject: Record<string, number> = {};
    let taskHours = 0;
    for (const e of own.filter((x) => x.entry_type === "task" && x.task_id)) {
      const project = taskProject.get(e.task_id!);
      if (!project) continue;
      const h = hoursOf(e);
      byProject[project] = (byProject[project] ?? 0) + h;
      taskHours += h;
      projectIds.add(project);
    }
    for (const k of Object.keys(byProject)) byProject[k] = round1(byProject[k]);
    const capacityHours = round1((m.weeklyHours / 5) * workingDays);
    return {
      memberId: m.id,
      name: m.name,
      clockHours: round1(own.filter((e) => e.entry_type === "clock").reduce((s, e) => s + hoursOf(e), 0)),
      taskHours: round1(taskHours),
      capacityHours,
      utilization: capacityHours ? Math.round((taskHours / capacityHours) * 100) : null,
      byProject,
    };
  });
  return { rows: rows.sort((a, b) => a.name.localeCompare(b.name, "es")), projectIds: [...projectIds] };
}

/** Días hábiles entre dos fechas (inclusive) sin festivos. */
export function countWorkingDays(from: ISODate, to: ISODate, holidays: ReadonlySet<string>): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWeekday(d) && !holidays.has(d)) n++;
  return n;
}

// ─────────────────────────────────────────────────────────────
// Ausencias
// ─────────────────────────────────────────────────────────────

export interface AbsencesRow {
  memberId: string;
  name: string;
  /** Días hábiles de ausencia aprobada en el período, por tipo */
  days: Record<AbsenceKind, number>;
  total: number;
  /** Saldo de vacaciones del año */
  allowance: number;
  usedThisYear: number;
  available: number;
}

export interface AbsencesInput {
  members: { id: string; name: string; annualDays: number }[];
  requests: { membership_id: string; start_date: ISODate; end_date: ISODate; status: string; kind: AbsenceKind }[];
  from: ISODate;
  to: ISODate;
  year: number;
  holidays: ReadonlySet<string>;
}

/** Ausencias aprobadas del período por tipo, y el saldo anual de vacaciones. */
export function absencesReport({ members, requests, from, to, year, holidays }: AbsencesInput): AbsencesRow[] {
  return members
    .map((m) => {
      const approved = requests.filter((r) => r.membership_id === m.id && r.status === "approved");
      const days: Record<AbsenceKind, number> = { vacation: 0, personal: 0, sick: 0, other: 0 };
      for (const r of approved) {
        // Solo la parte que cae dentro del período
        const start = r.start_date > from ? r.start_date : from;
        const end = r.end_date < to ? r.end_date : to;
        if (start > end) continue;
        days[r.kind] += businessDays({ start_date: start, end_date: end }, holidays);
      }
      const usedThisYear = approved
        .filter((r) => countsAgainstBalance(r.kind) && r.start_date.startsWith(`${year}-`))
        .reduce((s, r) => s + businessDays(r, holidays), 0);
      return {
        memberId: m.id,
        name: m.name,
        days,
        total: days.vacation + days.personal + days.sick + days.other,
        allowance: m.annualDays,
        usedThisYear,
        available: m.annualDays - usedThisYear,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

// ─────────────────────────────────────────────────────────────
// CSV para Excel en español
// ─────────────────────────────────────────────────────────────

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * CSV que Excel abre bien en configuración regional española: separador ";",
 * coma decimal y BOM UTF-8 (para que las tildes se vean bien).
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const text = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map((c) => cell(c.header)).join(";"), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(";"))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
