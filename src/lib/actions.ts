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
    "department must belong to the same organization": "El departamento no pertenece a esta organización.",
    "department head must belong to the same organization": "El responsable debe pertenecer a la organización.",
    "member must belong to the same organization": "La persona no pertenece a esta organización.",
  };
  for (const [key, text] of Object.entries(known)) if (msg.includes(key)) return text;
  if (error?.code === "23505") return "Ya existe un registro igual.";
  if (error?.code === "42501") return "No tenés permisos para esta acción.";
  return "Algo salió mal. Probá de nuevo.";
}
