import "server-only";
import { getHolidaySet } from "@/lib/data/calendar";
import { getEmployees } from "@/lib/data/employees";
import { getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getWorkOrdersInRange } from "@/lib/data/work-orders";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { addDays, monthEnd, todayISO, type ISODate } from "@/lib/domain/periods";
import {
  absencesReport,
  billingReport,
  countWorkingDays,
  hoursReport,
  type AbsencesRow,
  type BillingRow,
  type CsvColumn,
  type HoursRow,
} from "@/lib/domain/reports";
import { ABSENCE_LABEL } from "@/lib/domain/vacations";
import { createClient } from "@/lib/supabase/server";

// Datos de los informes. La página y la exportación CSV usan exactamente estas
// funciones: lo que se descarga es lo que se ve. RLS acota lo que cada uno puede leer.

export type ReportType = "facturacion" | "horas" | "ausencias";

export const REPORT_LABEL: Record<ReportType, string> = {
  facturacion: "Facturación",
  horas: "Horas por persona",
  ausencias: "Ausencias",
};

/** Qué informes puede ver la persona actual. */
export async function availableReports(orgId: string): Promise<ReportType[]> {
  const ctx = await getOrgContext(orgId);
  const out: ReportType[] = [];
  if (ctx.can("billing.manage")) out.push("facturacion");
  if (ctx.can("time.view_team")) out.push("horas");
  if (ctx.can("vacations.approve")) out.push("ausencias");
  return out;
}

const startIso = (d: ISODate) => new Date(`${d}T00:00:00`).toISOString();

/** Equipo visible: toda la organización para administración, si no la línea de reporte (más uno mismo). */
async function scopedMembers(orgId: string) {
  const ctx = await getOrgContext(orgId);
  const employees = await getEmployees(orgId);
  const visible = supervisedIds(employees, ctx.membership.id, ctx.can("employees.manage"));
  visible.add(ctx.membership.id);
  return employees.filter((e) => visible.has(e.id) && e.status === "active");
}

export async function getBillingReport(orgId: string, month: ISODate) {
  const [workOrders, projects, tasks, minutes] = await Promise.all([
    getWorkOrdersInRange(orgId, month, monthEnd(month)),
    getProjects(orgId),
    getTasks(orgId),
    getTaskMinutes(orgId),
  ]);
  const minutesByWorkOrder = new Map<string, number>();
  for (const t of tasks) {
    if (!t.work_order_id) continue;
    minutesByWorkOrder.set(t.work_order_id, (minutesByWorkOrder.get(t.work_order_id) ?? 0) + (minutes.get(t.id) ?? 0));
  }
  return billingReport({
    workOrders: workOrders.map((w) => ({
      ...w,
      budgeted_hours: w.budgeted_hours === null ? null : Number(w.budgeted_hours),
      hourly_rate: w.hourly_rate === null ? null : Number(w.hourly_rate),
    })),
    projects,
    minutesByWorkOrder,
  });
}

/**
 * Hasta qué día se cuenta la capacidad: en el mes en curso, hasta hoy (si no, la
 * dedicación de un mes recién empezado sale artificialmente baja); en meses
 * pasados, el mes completo.
 */
function capacityUntil(month: ISODate): ISODate {
  const to = monthEnd(month);
  const today = todayISO();
  return today >= month && today < to ? today : to;
}

export async function getHoursReport(orgId: string, month: ISODate) {
  const to = monthEnd(month);
  const members = await scopedMembers(orgId);
  const supabase = await createClient();
  const [entries, tasks, projects, holidays] = await Promise.all([
    members.length
      ? supabase
          .from("time_entries")
          .select("membership_id, entry_type, task_id, started_at, ended_at")
          .in(
            "membership_id",
            members.map((m) => m.id),
          )
          .gte("started_at", startIso(month))
          .lt("started_at", startIso(addDays(to, 1)))
          .then((r) => {
            if (r.error) throw r.error;
            return r.data ?? [];
          })
      : Promise.resolve([]),
    getTasks(orgId),
    getProjects(orgId),
    getHolidaySet(orgId, month, to),
  ]);
  const report = hoursReport({
    members: members.map((m) => ({ id: m.id, name: displayName(m.profile), weeklyHours: Number(m.weekly_hours) })),
    entries,
    taskProject: new Map(tasks.map((t) => [t.id, t.project_id])),
    workingDays: countWorkingDays(month, capacityUntil(month), holidays),
  });
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const columns = report.projectIds
    .map((id) => ({ id, name: projectName.get(id) ?? "Proyecto" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { ...report, projects: columns, partial: capacityUntil(month) < to };
}

export async function getAbsencesReport(orgId: string, month: ISODate) {
  const to = monthEnd(month);
  const year = Number(month.slice(0, 4));
  const members = await scopedMembers(orgId);
  const supabase = await createClient();
  const [requests, holidays] = await Promise.all([
    members.length
      ? supabase
          .from("vacation_requests")
          .select("membership_id, start_date, end_date, status, kind")
          .in(
            "membership_id",
            members.map((m) => m.id),
          )
          .eq("status", "approved")
          .then((r) => {
            if (r.error) throw r.error;
            return r.data ?? [];
          })
      : Promise.resolve([]),
    getHolidaySet(orgId, `${year}-01-01`, `${year}-12-31`),
  ]);
  return absencesReport({
    members: members.map((m) => ({ id: m.id, name: displayName(m.profile), annualDays: Number(m.annual_vacation_days) })),
    requests,
    from: month,
    to,
    year,
    holidays,
  });
}

// ─────────────────────────────────────────────────────────────
// Columnas del CSV de cada informe
// ─────────────────────────────────────────────────────────────

export const BILLING_COLUMNS: CsvColumn<BillingRow>[] = [
  { header: "Cliente", value: (r) => r.client },
  { header: "Proyecto", value: (r) => r.project },
  { header: "OT", value: (r) => r.code },
  { header: "Título", value: (r) => r.workOrder },
  { header: "Estado", value: (r) => r.status },
  { header: "Facturación", value: (r) => (r.billing === "invoiced" ? "Facturada" : "Sin facturar") },
  { header: "Horas presupuestadas", value: (r) => r.budgetedHours },
  { header: "Horas imputadas", value: (r) => r.loggedHours },
  { header: "Tarifa (€/h)", value: (r) => r.hourlyRate },
  { header: "Importe (€)", value: (r) => r.amount },
  { header: "Presupuesto (€)", value: (r) => r.budgetAmount },
];

export function hoursColumns(projects: { id: string; name: string }[]): CsvColumn<HoursRow>[] {
  return [
    { header: "Persona", value: (r) => r.name },
    { header: "Horas fichadas", value: (r) => r.clockHours },
    { header: "Horas imputadas", value: (r) => r.taskHours },
    { header: "Capacidad (h, hasta hoy si es el mes en curso)", value: (r) => r.capacityHours },
    { header: "% dedicación", value: (r) => r.utilization },
    ...projects.map((p) => ({ header: p.name, value: (r: HoursRow) => r.byProject[p.id] ?? 0 })),
  ];
}

export const ABSENCES_COLUMNS: CsvColumn<AbsencesRow>[] = [
  { header: "Persona", value: (r) => r.name },
  { header: ABSENCE_LABEL.vacation, value: (r) => r.days.vacation },
  { header: ABSENCE_LABEL.personal, value: (r) => r.days.personal },
  { header: ABSENCE_LABEL.sick, value: (r) => r.days.sick },
  { header: ABSENCE_LABEL.other, value: (r) => r.days.other },
  { header: "Total del mes", value: (r) => r.total },
  { header: "Vacaciones del año", value: (r) => r.allowance },
  { header: "Usadas en el año", value: (r) => r.usedThisYear },
  { header: "Disponibles", value: (r) => r.available },
];
