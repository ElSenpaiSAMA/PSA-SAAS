import "server-only";
import { getAbsences } from "@/lib/data/calendar";
import { getEmployees } from "@/lib/data/employees";
import { getPending } from "@/lib/data/inbox";
import { getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getHoursReport } from "@/lib/data/reports";
import { getOrgContext } from "@/lib/data/session";
import { getMyEntriesSince } from "@/lib/data/time";
import { getAllWorkOrders } from "@/lib/data/work-orders";
import { extractJson, parseAllocation, toQuarter, type AllocationItem } from "@/lib/domain/ai";
import { displayName } from "@/lib/domain/hierarchy";
import { addDays, monthStart, todayISO } from "@/lib/domain/periods";
import { entryMinutes, isSameDay } from "@/lib/domain/time";
import { acceptsTimeEntries } from "@/lib/domain/work-orders";
import { chat } from "./openrouter";

/**
 * Propone cómo repartir las horas trabajadas hoy (aún no imputadas) entre las
 * tareas abiertas de la persona. La propuesta se valida: tareas reales, cuartos
 * de hora y nunca más de lo trabajado. La persona la revisa antes de imputar.
 */
export async function suggestAllocation(orgId: string): Promise<{ items: AllocationItem[]; availableHours: number; note?: string }> {
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership.id;
  const now = new Date();
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);

  const [entries, tasks, projects, workOrders, minutes] = await Promise.all([
    getMyEntriesSince(me, since.toISOString()),
    getTasks(orgId),
    getProjects(orgId),
    getAllWorkOrders(orgId),
    getTaskMinutes(orgId),
  ]);
  const today = entries.filter((e) => isSameDay(new Date(e.started_at), now));
  const worked = today.filter((e) => e.entry_type === "clock").reduce((s, e) => s + entryMinutes(e, now), 0) / 60;
  const imputed = today.filter((e) => e.entry_type === "task").reduce((s, e) => s + entryMinutes(e, now), 0) / 60;
  const availableHours = toQuarter(Math.max(0, worked - imputed));

  const workOrderById = new Map(workOrders.map((w) => [w.id, w]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const open = tasks.filter((t) => {
    if (t.assigned_to !== me || t.status === "done") return false;
    const wo = t.work_order_id ? workOrderById.get(t.work_order_id) : undefined;
    return !t.work_order_id || (wo !== undefined && acceptsTimeEntries(wo.status));
  });

  if (availableHours < 0.25) return { items: [], availableHours, note: "No hay horas fichadas hoy sin imputar." };
  if (!open.length) return { items: [], availableHours, note: "No tenés tareas abiertas en órdenes de trabajo activas." };

  const { content } = await chat({
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "Repartís horas de trabajo entre tareas. Respondé SOLO con JSON: un array de objetos {\"taskId\": string, \"hours\": number, \"reason\": string}. " +
          "Usá únicamente los taskId dados. Las horas van en múltiplos de 0.25 y su suma no puede superar las horas disponibles. " +
          "Priorizá tareas en curso, con vencimiento cercano y con horas estimadas pendientes. 'reason' es una frase corta en español.",
      },
      {
        role: "user",
        content: JSON.stringify({
          hoy: todayISO(),
          horas_disponibles: availableHours,
          tareas: open.map((t) => ({
            taskId: t.id,
            titulo: t.title,
            proyecto: projectName.get(t.project_id),
            estado: t.status,
            vence: t.due_date,
            horas_estimadas: t.estimated_hours,
            horas_ya_imputadas: Math.round(((minutes.get(t.id) ?? 0) / 60) * 10) / 10,
          })),
        }),
      },
    ],
  });
  const items = parseAllocation(extractJson(content ?? ""), open, availableHours);
  return { items, availableHours, note: items.length ? undefined : "La IA no pudo proponer un reparto. Imputá las horas a mano." };
}

/** Resumen redactado del equipo: horas del mes, ausencias próximas, pendientes y riesgos. */
export async function teamSummary(orgId: string): Promise<string> {
  const ctx = await getOrgContext(orgId);
  const today = todayISO();
  const [hours, absences, pending, employees] = await Promise.all([
    getHoursReport(orgId, monthStart(today)),
    getAbsences(orgId, today, addDays(today, 14)),
    getPending(orgId),
    getEmployees(orgId),
  ]);
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));

  const { content } = await chat({
    maxTokens: 600,
    messages: [
      {
        role: "system",
        content:
          "Escribís el resumen semanal de un equipo para su responsable. En español, tono profesional y directo. " +
          "Máximo 6 líneas con '- ' al inicio: primero cómo viene el mes (horas e imputación), después quién estará ausente, " +
          "y por último riesgos o acciones concretas (sobrecarga, baja dedicación, pendientes urgentes). Usá solo los datos dados.",
      },
      {
        role: "user",
        content: JSON.stringify({
          empresa: ctx.organization.name,
          hoy: today,
          horas_del_mes: hours.rows.map((r) => ({
            persona: r.name,
            fichadas: r.clockHours,
            imputadas: r.taskHours,
            capacidad_hasta_hoy: r.capacityHours,
            dedicacion_pct: r.utilization,
          })),
          ausencias_proximas_14_dias: absences.map((a) => ({ persona: names.get(a.membership_id), desde: a.start_date, hasta: a.end_date, estado: a.status })),
          pendientes_de_quien_lee: pending.map((p) => ({ que: p.title, urgente: p.urgent })),
        }),
      },
    ],
  });
  return content?.trim() || "No se pudo generar el resumen.";
}
