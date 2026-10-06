// Catálogo de automatizaciones tal como se muestran en la app. El comportamiento
// vive en la base (0010_automations.sql); acá solo los textos, cómo se agrupan y
// qué parámetros se pueden editar (con sus límites).

export type AutomationArea = "vacations" | "time" | "work_orders" | "tasks" | "team";

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  suffix: string;
}

export interface AutomationMeta {
  key: string;
  area: AutomationArea;
  name: string;
  when: string;
  then: string;
  schedule?: string;
  params: ParamSpec[];
}

export const AREA_LABEL: Record<AutomationArea, string> = {
  vacations: "Vacaciones",
  time: "Fichaje",
  work_orders: "Órdenes de trabajo",
  tasks: "Tareas",
  team: "Equipo",
};

export const AUTOMATIONS: AutomationMeta[] = [
  {
    key: "vacations.auto_approve_short",
    area: "vacations",
    name: "Aprobar solas las ausencias cortas",
    when: "Alguien pide hasta {max_days} día(s), con al menos {min_notice_days} días de aviso",
    then: "Si nadie más de su departamento está ausente esos días, se aprueba sola y se avisa a la persona",
    params: [
      { key: "max_days", label: "Días como máximo", min: 1, max: 5, suffix: "días" },
      { key: "min_notice_days", label: "Aviso mínimo", min: 0, max: 60, suffix: "días" },
    ],
  },
  {
    key: "vacations.escalate_stale",
    area: "vacations",
    name: "Escalar solicitudes sin respuesta",
    when: "Una solicitud lleva más de {after_days} días pendiente",
    then: "Se avisa al responsable de quien debía aprobarla y a administración",
    schedule: "Revisa cada 15 minutos",
    params: [{ key: "after_days", label: "Días sin respuesta", min: 1, max: 30, suffix: "días" }],
  },
  {
    key: "time.auto_close_clock",
    area: "time",
    name: "Cerrar fichajes olvidados",
    when: "Un fichaje (o una pausa) lleva más de {max_hours} horas abierto",
    then: "Se cierra en ese límite y se le pide a la persona que lo revise",
    schedule: "Revisa cada 15 minutos",
    params: [{ key: "max_hours", label: "Horas como máximo", min: 4, max: 24, suffix: "h" }],
  },
  {
    key: "time.clock_out_reminder",
    area: "time",
    name: "Recordar fichar la salida",
    when: "A partir de las {hour}:00 alguien sigue fichado",
    then: "Le llega un recordatorio (una vez por jornada)",
    schedule: "Cada día desde la hora elegida",
    params: [{ key: "hour", label: "Hora", min: 12, max: 23, suffix: "h" }],
  },
  {
    key: "work_orders.budget_alert",
    area: "work_orders",
    name: "Avisar consumo del presupuesto",
    when: "Las horas imputadas a una OT superan el 80 % o el 100 % de su presupuesto",
    then: "Se avisa a quienes gestionan el proyecto (una vez por umbral)",
    params: [],
  },
  {
    key: "work_orders.auto_close",
    area: "work_orders",
    name: "Cerrar OT al terminar el período",
    when: "Pasaron {grace_days} días desde el fin del período y la OT sigue abierta",
    then: "Se cierra (deja de admitir horas) y facturación recibe el aviso para facturarla",
    schedule: "Revisa cada 15 minutos",
    params: [{ key: "grace_days", label: "Días de margen", min: 0, max: 15, suffix: "días" }],
  },
  {
    key: "work_orders.recurring",
    area: "work_orders",
    name: "Crear las OT del mes",
    when: "Empieza un mes y un proyecto activo tuvo OT el mes anterior pero no tiene la de este",
    then: "Se copia con sus tareas, en borrador, y se avisa a quienes gestionan el proyecto para aprobarla",
    schedule: "Al empezar cada mes",
    params: [],
  },
  {
    key: "tasks.due_reminder",
    area: "tasks",
    name: "Recordar vencimientos",
    when: "Una tarea vence en {days_before} día(s) o ya venció sin terminarse",
    then: "Se avisa a la persona asignada (una vez por tarea)",
    schedule: "Cada día desde las {hour}:00",
    params: [
      { key: "days_before", label: "Días de anticipación", min: 0, max: 7, suffix: "días" },
      { key: "hour", label: "Hora del aviso", min: 6, max: 12, suffix: "h" },
    ],
  },
  {
    key: "team.weekly_summary",
    area: "team",
    name: "Resumen semanal del equipo",
    when: "Es lunes a las {hour}:00",
    then: "Cada responsable recibe las horas fichadas de su equipo, las vacaciones por aprobar y las tareas vencidas",
    schedule: "Lunes a la hora elegida",
    params: [{ key: "hour", label: "Hora", min: 6, max: 12, suffix: "h" }],
  },
];

export const AUTOMATION_BY_KEY = new Map(AUTOMATIONS.map((a) => [a.key, a]));

/** Reemplaza {param} en los textos con el valor configurado. */
export function fillText(text: string, params: Record<string, unknown>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

/** Configuración efectiva: la de la empresa si existe, si no la del catálogo. */
export function effectiveConfig(
  template: { default_enabled: boolean; default_params: Record<string, unknown> },
  rule: { enabled: boolean; params: Record<string, unknown> } | undefined,
): { enabled: boolean; params: Record<string, unknown> } {
  return {
    enabled: rule?.enabled ?? template.default_enabled,
    params: { ...template.default_params, ...(rule?.params ?? {}) },
  };
}

/** Valida y normaliza los parámetros editables de una regla. */
export function parseParams(
  key: string,
  raw: Record<string, unknown>,
): { ok: true; params: Record<string, number> } | { ok: false; errors: Record<string, string> } {
  const meta = AUTOMATION_BY_KEY.get(key);
  if (!meta) return { ok: false, errors: { _: "Automatización desconocida" } };
  const params: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const spec of meta.params) {
    const value = Number(raw[spec.key]);
    if (raw[spec.key] === "" || raw[spec.key] === undefined || !Number.isInteger(value)) errors[spec.key] = "Ingresá un número entero";
    else if (value < spec.min || value > spec.max) errors[spec.key] = `Entre ${spec.min} y ${spec.max}`;
    else params[spec.key] = value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, params };
}
