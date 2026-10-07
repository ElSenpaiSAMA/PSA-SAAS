import type { FieldErrors } from "@/lib/validation/schemas";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Cambia en cada envío para que el cliente pueda resetear el form tras un éxito */
  submittedAt?: number;
};

export const idle: ActionState = { status: "idle" };

export function fail(message: string, fieldErrors?: FieldErrors): ActionState {
  return { status: "error", message, fieldErrors, submittedAt: Date.now() };
}

export function ok(message?: string): ActionState {
  return { status: "success", message, submittedAt: Date.now() };
}

/** Traduce errores de Postgres/RLS lanzados por los triggers a mensajes para el usuario. */
export function dbErrorMessage(error: { message?: string; code?: string } | null): string {
  const msg = error?.message ?? "";
  const known: Record<string, string> = {
    "cannot change your own role or status": "No podés cambiar tu propio rol o estado.",
    "insufficient rank for this change": "Tu rango no permite este cambio.",
    "manager must belong to the same organization": "El manager debe pertenecer a la organización.",
    "manager assignment would create a cycle": "Esa asignación crearía un ciclo en el organigrama.",
    "clock-in time cannot be modified": "La hora de entrada no se puede modificar.",
    "closed clock entries cannot be modified": "Un fichaje cerrado no se puede modificar.",
    "you cannot decide on your own request": "No podés decidir sobre tu propia solicitud.",
    "only pending requests can change": "Solo se pueden modificar solicitudes pendientes.",
    "only status can be changed on assigned tasks": "Solo podés cambiar el estado de tus tareas.",
    "cannot invite with a rank equal or higher than yours": "No podés invitar con un rango igual o superior al tuyo.",
    "invitation not found": "La invitación no existe o ya fue usada.",
    "task must belong to the same organization": "La tarea no pertenece a esta organización.",
    "not a member of this project": "No sos miembro de este proyecto.",
    "work order is not open for time entries": "La orden de trabajo no está abierta: no admite horas.",
    "invoiced work orders are locked": "La OT está facturada y no se puede modificar.",
    "only closed work orders can be invoiced": "Solo se puede facturar una OT cerrada.",
    "billing changes require billing permission": "No tenés permisos de facturación.",
    "work order not found": "OT no encontrada o sin permisos.",
    "invalid period": "El período no es válido.",
    "department must belong to the same organization": "El departamento no pertenece a esta organización.",
    "department head must belong to the same organization": "El responsable debe pertenecer a la organización.",
    "member must belong to the same organization": "La persona no pertenece a esta organización.",
    "thread is locked": "El hilo está cerrado: ya no admite respuestas.",
    "only moderators can pin or lock threads": "Solo la administración puede fijar o cerrar hilos.",
    "only the author can edit the thread": "Solo quien escribió el hilo puede editarlo.",
    "only the author can edit the post": "Solo quien escribió la respuesta puede editarla.",
    "thread not found": "El hilo no existe o fue borrado.",
  };
  for (const [key, text] of Object.entries(known)) if (msg.includes(key)) return text;
  if (error?.code === "23505") return "Ya existe un registro igual.";
  if (error?.code === "42501") return "No tenés permisos para esta acción.";
  return "Algo salió mal. Probá de nuevo.";
}
