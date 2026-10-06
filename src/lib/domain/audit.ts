export interface AuditLike {
  action: string;
  table_name: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** "hace 5 minutos", "ayer"… relativo a `now`; más de una semana: fecha corta. */
export function relativeTime(iso: string, now: number): string {
  const diff = (now - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (diff < 60) return "hace instantes";
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86_400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 604_800) return rtf.format(-Math.round(diff / 86_400), "day");
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export type AuditCategory ="auth" | "people" | "time" | "vacations" | "projects" | "other";

const TABLE_CATEGORY: Record<string, AuditCategory> = {
  memberships: "people",
  invitations: "people",
  time_entries: "time",
  vacation_requests: "vacations",
  projects: "projects",
  tasks: "projects",
};

export function auditCategory(e: AuditLike): AuditCategory {
  if (e.action.startsWith("auth.")) return "auth";
  if (!e.table_name) return "other";
  return TABLE_CATEGORY[e.table_name] ?? "other";
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Campos que cambiaron entre old y new (ignora timestamps de sistema). */
export function changedFields(e: AuditLike): string[] {
  if (!e.old_data || !e.new_data) return [];
  const ignore = new Set(["updated_at", "created_at"]);
  return Object.keys(e.new_data).filter(
    (k) => !ignore.has(k) && JSON.stringify(e.old_data![k]) !== JSON.stringify(e.new_data![k]),
  );
}

const STATUS_VERB: Record<string, string> = {
  approved: "aprobó una solicitud de vacaciones",
  rejected: "rechazó una solicitud de vacaciones",
  cancelled: "canceló una solicitud de vacaciones",
};

const TASK_STATUS: Record<string, string> = { todo: "por hacer", in_progress: "en curso", done: "hecha" };

/** Frase legible en español para un registro de auditoría. */
export function describeAudit(e: AuditLike): string {
  const row = e.new_data ?? e.old_data ?? {};
  switch (e.action) {
    case "auth.login":
      return "inició sesión";
    case "auth.logout":
      return "cerró sesión";
    case "auth.signup":
      return "creó su cuenta";
    case "organization.created":
      return "creó la organización";
  }

  switch (e.table_name) {
    case "time_entries": {
      if (row.entry_type === "break") {
        if (e.action === "INSERT") return "pausó la jornada";
        if (e.action === "UPDATE" && changedFields(e).includes("ended_at")) return "reanudó la jornada";
      }
      const isClock = row.entry_type === "clock";
      if (e.action === "INSERT") return isClock ? "fichó entrada" : "imputó horas a una tarea";
      if (e.action === "UPDATE" && isClock && changedFields(e).includes("ended_at")) return "fichó salida";
      if (e.action === "DELETE") return "eliminó un registro de horas";
      return "modificó un registro de horas";
    }
    case "vacation_requests": {
      if (e.action === "INSERT") return `solicitó vacaciones del ${str(row.start_date)} al ${str(row.end_date)}`;
      if (e.action === "UPDATE" && changedFields(e).includes("status")) {
        return STATUS_VERB[str(row.status)] ?? "actualizó una solicitud de vacaciones";
      }
      return "modificó una solicitud de vacaciones";
    }
    case "tasks": {
      if (e.action === "INSERT") return `creó la tarea "${str(row.title)}"`;
      if (e.action === "DELETE") return `eliminó la tarea "${str(row.title)}"`;
      const fields = changedFields(e);
      if (fields.length === 1 && fields[0] === "status") {
        return `movió "${str(row.title)}" a ${TASK_STATUS[str(row.status)] ?? str(row.status)}`;
      }
      return `editó la tarea "${str(row.title)}"`;
    }
    case "projects": {
      if (e.action === "INSERT") return `creó el proyecto "${str(row.name)}"`;
      if (changedFields(e).includes("status")) {
        return row.status === "archived" ? `archivó el proyecto "${str(row.name)}"` : `reactivó el proyecto "${str(row.name)}"`;
      }
      return `editó el proyecto "${str(row.name)}"`;
    }
    case "invitations": {
      if (e.action === "INSERT") return `invitó a ${str(row.email)}`;
      if (e.action === "DELETE") return `revocó la invitación a ${str(row.email)}`;
      if (changedFields(e).includes("accepted_at")) return `aceptó la invitación (${str(row.email)})`;
      return "actualizó una invitación";
    }
    case "memberships": {
      if (e.action === "INSERT") return "se unió a la organización";
      if (e.action === "DELETE") return "eliminó a un miembro";
      const fields = changedFields(e);
      if (fields.includes("role_id")) return `cambió un rol a ${str(row.role_id)}`;
      if (fields.includes("manager_id")) return "reasignó un manager";
      return "editó los datos de un miembro";
    }
  }
  return e.action.toLowerCase();
}

/**
 * Pausar cierra el tramo de trabajo y abre una pausa en la misma transacción
 * (mismo instante); reanudar, al revés. Esos cierres/aperturas de tramo son
 * detalle técnico: se ocultan para que el historial diga "pausó" / "reanudó"
 * y no "fichó salida" / "fichó entrada".
 */
export function foldClockSegments<T extends AuditLike>(entries: readonly T[]): T[] {
  const key = (membership: unknown, at: unknown) => `${String(membership)}@${String(at)}`;
  const breakStarts = new Set<string>();
  const breakEnds = new Set<string>();
  for (const e of entries) {
    const row = e.new_data;
    if (e.table_name !== "time_entries" || row?.entry_type !== "break") continue;
    if (e.action === "INSERT") breakStarts.add(key(row.membership_id, row.started_at));
    if (e.action === "UPDATE" && row.ended_at) breakEnds.add(key(row.membership_id, row.ended_at));
  }
  if (!breakStarts.size && !breakEnds.size) return [...entries];
  return entries.filter((e) => {
    const row = e.new_data;
    if (e.table_name !== "time_entries" || row?.entry_type !== "clock") return true;
    if (e.action === "UPDATE" && breakStarts.has(key(row.membership_id, row.ended_at))) return false;
    if (e.action === "INSERT" && breakEnds.has(key(row.membership_id, row.started_at))) return false;
    return true;
  });
}
