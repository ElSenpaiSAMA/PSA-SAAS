// Avisos que se pueden silenciar por persona. Espejo de public.mutable_notification_kinds():
// solo lo informativo; lo que pide una acción (aprobar vacaciones o correcciones de
// fichaje) siempre llega. Lo configura administración: en el perfil se ve en solo lectura.

export interface NotificationGroup {
  key: string;
  label: string;
  description: string;
  kinds: readonly string[];
  /** Solo se muestra a quien tiene ese permiso */
  permission?: "contact.manage" | "billing.manage";
}

export const NOTIFICATION_GROUPS: readonly NotificationGroup[] = [
  {
    key: "mentions",
    label: "Menciones",
    description: "Cuando alguien te menciona con @ en el foro.",
    kinds: ["forum.mention"],
  },
  {
    key: "forum",
    label: "Actividad del foro",
    description: "Respuestas en tus hilos y avisos nuevos de la empresa.",
    kinds: ["forum.reply", "forum.notice"],
  },
  {
    key: "tasks",
    label: "Tareas y proyectos",
    description: "Te asignan una tarea, vence pronto o te suman a un proyecto.",
    kinds: ["task.assigned", "task.due_soon", "task.overdue", "project.added"],
  },
  {
    key: "reminders",
    label: "Recordatorios",
    description: "Recordatorio de fichar, fichajes cerrados solos y el resumen semanal del equipo.",
    kinds: ["clock.reminder", "clock.auto_closed", "team.weekly_summary"],
  },
  {
    key: "work_orders",
    label: "Órdenes de trabajo",
    description: "OT creadas, presupuesto al límite, cierres automáticos y listas para facturar.",
    kinds: ["work_order.created", "work_order.budget", "work_order.auto_closed", "work_order.to_invoice"],
    permission: "billing.manage",
  },
  {
    key: "contact",
    label: "Mensajes de la web",
    description: "Cada consulta nueva del formulario de contacto.",
    kinds: ["contact.received"],
    permission: "contact.manage",
  },
];

export const MUTABLE_KINDS: readonly string[] = NOTIFICATION_GROUPS.flatMap((g) => g.kinds);

/** Un grupo está activo si no se silenció ninguno de sus avisos. */
export function isGroupEnabled(group: NotificationGroup, muted: readonly string[]): boolean {
  return !group.kinds.some((k) => muted.includes(k));
}
