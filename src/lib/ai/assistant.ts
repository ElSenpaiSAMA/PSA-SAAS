import "server-only";
import { getAbsences, getHolidays } from "@/lib/data/calendar";
import { getDepartments } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getPending } from "@/lib/data/inbox";
import { getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { availableReports, getBillingReport, getHoursReport } from "@/lib/data/reports";
import { getOrgContext } from "@/lib/data/session";
import { getWorkOrdersInRange } from "@/lib/data/work-orders";
import { capList } from "@/lib/domain/ai";
import { displayName } from "@/lib/domain/hierarchy";
import { addDays, monthEnd, monthStart, parseMonthParam, todayISO, type ISODate } from "@/lib/domain/periods";
import { ROLE_LABEL, isRole } from "@/lib/domain/permissions";
import { workOrderCode } from "@/lib/domain/work-orders";
import { chat, type ChatMessage, type ToolDefinition } from "./openrouter";

// Asistente de Kairos: responde preguntas con datos reales usando herramientas de
// SOLO LECTURA. Cada herramienta usa las funciones de datos de la app, con la sesión
// de quien pregunta: RLS decide qué puede ver. No hay herramientas sobre datos
// sensibles (fichas personales, sueldos, DNI).

const MAX_ROWS = 40;
const isoDate = (v: unknown, fallback: ISODate) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback);
const monthOf = (v: unknown) => (typeof v === "string" ? parseMonthParam(v.slice(0, 7)) : null) ?? monthStart(todayISO());

const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "ausencias",
      description: "Ausencias del equipo (vacaciones aprobadas; pendientes solo si quien pregunta puede verlas) y festivos en un rango de fechas.",
      parameters: {
        type: "object",
        properties: { desde: { type: "string", description: "YYYY-MM-DD" }, hasta: { type: "string", description: "YYYY-MM-DD" } },
        required: ["desde", "hasta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ordenes_de_trabajo",
      description: "Órdenes de trabajo de un mes: proyecto, estado, horas imputadas contra presupuesto y, si quien pregunta puede facturar, importes.",
      parameters: { type: "object", properties: { mes: { type: "string", description: "YYYY-MM" } }, required: ["mes"] },
    },
  },
  {
    type: "function",
    function: {
      name: "mis_tareas",
      description: "Tareas asignadas a quien pregunta que no están terminadas, con proyecto, fechas, estimación y horas imputadas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "horas_del_equipo",
      description: "Horas fichadas e imputadas por persona y proyecto en un mes, contra su capacidad. Solo para quien supervisa un equipo.",
      parameters: { type: "object", properties: { mes: { type: "string", description: "YYYY-MM" } }, required: ["mes"] },
    },
  },
  {
    type: "function",
    function: {
      name: "pendientes",
      description: "Lo que espera una acción de quien pregunta: OT por cerrar o facturar, tareas vencidas, fichajes olvidados.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "personas",
      description: "Directorio de la empresa: nombre, puesto, rol, departamento y a quién reporta cada persona.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function runTool(orgId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  const ctx = await getOrgContext(orgId);
  const today = todayISO();
  switch (name) {
    case "ausencias": {
      const from = isoDate(args.desde, today);
      const to = isoDate(args.hasta, addDays(from, 30));
      const [absences, holidays, employees] = await Promise.all([getAbsences(orgId, from, to), getHolidays(orgId, from, to), getEmployees(orgId)]);
      const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
      const { items, omitted } = capList(absences, MAX_ROWS);
      return {
        ausencias: items.map((a) => ({ persona: names.get(a.membership_id) ?? "Alguien", desde: a.start_date, hasta: a.end_date, estado: a.status })),
        festivos: holidays.map((h) => ({ fecha: h.date, nombre: h.name })),
        omitidas: omitted,
      };
    }
    case "ordenes_de_trabajo": {
      const month = monthOf(args.mes);
      if ((await availableReports(orgId)).includes("facturacion")) {
        const { rows, totals } = await getBillingReport(orgId, month);
        return { mes: month.slice(0, 7), ordenes: capList(rows, MAX_ROWS).items, totales: totals };
      }
      const [workOrders, projects, tasks, minutes] = await Promise.all([
        getWorkOrdersInRange(orgId, month, monthEnd(month)),
        getProjects(orgId),
        getTasks(orgId),
        getTaskMinutes(orgId),
      ]);
      const projectName = new Map(projects.map((p) => [p.id, p.name]));
      return {
        mes: month.slice(0, 7),
        ordenes: capList(workOrders, MAX_ROWS).items.map((w) => ({
          codigo: workOrderCode(w.number),
          titulo: w.title,
          proyecto: projectName.get(w.project_id),
          estado: w.status,
          horas_presupuestadas: w.budgeted_hours,
          horas_imputadas:
            Math.round((tasks.filter((t) => t.work_order_id === w.id).reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60) * 10) / 10,
        })),
      };
    }
    case "mis_tareas": {
      const [tasks, projects, minutes] = await Promise.all([getTasks(orgId), getProjects(orgId), getTaskMinutes(orgId)]);
      const projectName = new Map(projects.map((p) => [p.id, p.name]));
      return capList(
        tasks.filter((t) => t.assigned_to === ctx.membership.id && t.status !== "done"),
        MAX_ROWS,
      ).items.map((t) => ({
        tarea: t.title,
        proyecto: projectName.get(t.project_id),
        estado: t.status,
        inicio: t.start_date,
        vence: t.due_date,
        horas_estimadas: t.estimated_hours,
        horas_imputadas: Math.round(((minutes.get(t.id) ?? 0) / 60) * 10) / 10,
      }));
    }
    case "horas_del_equipo": {
      if (!(await availableReports(orgId)).includes("horas")) return { error: "Quien pregunta no supervisa un equipo: solo puede consultar sus propias horas en Fichaje." };
      const month = monthOf(args.mes);
      const { rows, projects } = await getHoursReport(orgId, month);
      const projectName = new Map(projects.map((p) => [p.id, p.name]));
      return {
        mes: month.slice(0, 7),
        personas: rows.map((r) => ({
          persona: r.name,
          horas_fichadas: r.clockHours,
          horas_imputadas: r.taskHours,
          capacidad: r.capacityHours,
          dedicacion_pct: r.utilization,
          por_proyecto: Object.fromEntries(Object.entries(r.byProject).map(([id, h]) => [projectName.get(id) ?? id, h])),
        })),
      };
    }
    case "pendientes": {
      return (await getPending(orgId)).map((p) => ({ que: p.title, detalle: p.detail, urgente: p.urgent }));
    }
    case "personas": {
      const [employees, departments] = await Promise.all([getEmployees(orgId), getDepartments(orgId)]);
      const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
      const dept = new Map(departments.map((d) => [d.id, d.name]));
      return employees
        .filter((e) => e.status === "active")
        .map((e) => ({
          nombre: displayName(e.profile),
          puesto: e.position,
          rol: isRole(e.role_id) ? ROLE_LABEL[e.role_id] : e.role_id,
          departamento: e.department_id ? dept.get(e.department_id) : null,
          reporta_a: e.manager_id ? names.get(e.manager_id) : null,
        }));
    }
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

/** Responde una pregunta con datos de la empresa. Hasta 4 rondas de herramientas. */
export async function answerQuestion(orgId: string, question: string): Promise<string> {
  const ctx = await getOrgContext(orgId);
  const today = todayISO();
  const weekday = new Date(`${today}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long" });
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        `Sos el asistente de Kairos, una app de gestión de equipos y proyectos de la empresa ${ctx.organization.name}.`,
        `Hoy es ${weekday} ${today}. Quien pregunta tiene el rol ${ROLE_LABEL[ctx.role]}.`,
        "Respondé en español, en 2 a 6 frases o una lista corta. Usá las herramientas para obtener datos; nunca inventes cifras, nombres ni fechas.",
        "Si los datos no alcanzan o quien pregunta no tiene acceso, decilo con claridad y sugerí en qué sección de la app mirarlo.",
        "No tenés acceso a sueldos ni datos personales sensibles: si te los piden, explicá que solo se ven en la ficha del empleado con el permiso correspondiente.",
        "Formato: texto plano; para listas usá líneas que empiecen con '- '. Horas con 'h' y fechas como '12 oct'.",
      ].join("\n"),
    },
    { role: "user", content: question.slice(0, 500) },
  ];

  for (let round = 0; round < 4; round++) {
    const { content, toolCalls } = await chat({ messages, tools: TOOLS });
    if (!toolCalls.length) return content?.trim() || "No encontré una respuesta. Probá reformular la pregunta.";
    messages.push({ role: "assistant", content, tool_calls: toolCalls });
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // argumentos inválidos: la herramienta usa sus valores por defecto
      }
      let result: unknown;
      try {
        result = await runTool(orgId, call.function.name, args);
      } catch {
        result = { error: "No se pudieron leer esos datos." };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12_000) });
    }
  }
  const { content } = await chat({ messages });
  return content?.trim() || "No encontré una respuesta. Probá reformular la pregunta.";
}
