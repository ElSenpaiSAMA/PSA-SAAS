"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { decisionNoteSchema, fieldErrors, taskHoursSchema, timeCorrectionSchema } from "@/lib/validation/schemas";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

export async function clockIn(orgId: string): Promise<ActionState> {
  const { membership } = await getOrgContext(orgId);
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({ membership_id: membership.id, entry_type: "clock" });
  if (error) {
    if (error.code === "23505") return fail("Ya tenés un fichaje abierto.");
    if (error.message.includes("cannot be open at the same time")) return fail("Estás en pausa: reanudá la jornada.");
    return fail(dbErrorMessage(error));
  }
  refresh(orgId);
  return ok("Entrada registrada");
}

export async function pauseClock(orgId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_pause", { p_org_id: orgId });
  if (error) return fail(error.message.includes("not clocked in") ? "No tenés un fichaje abierto." : dbErrorMessage(error));
  refresh(orgId);
  return ok("Pausa iniciada");
}

export async function resumeClock(orgId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_resume", { p_org_id: orgId });
  if (error) return fail(error.message.includes("not on break") ? "No estás en pausa." : dbErrorMessage(error));
  refresh(orgId);
  return ok("Jornada reanudada");
}

export async function clockOut(orgId: string): Promise<ActionState> {
  const { membership } = await getOrgContext(orgId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("membership_id", membership.id)
    .in("entry_type", ["clock", "break"])
    .is("ended_at", null)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("No tenés un fichaje abierto.");
  refresh(orgId);
  return ok("Salida registrada");
}

export async function logTaskHours(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await getOrgContext(orgId);
  const parsed = taskHoursSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { taskId, date, hours } = parsed.data;
  // Mediodía UTC: cae en el mismo día calendario en cualquier zona horaria habitual
  const start = new Date(`${date}T12:00:00Z`);
  if (start.getTime() > Date.now() + 86_400_000) {
    return fail("No podés cargar horas en el futuro.", { date: ["Fecha futura"] });
  }
  const end = new Date(start.getTime() + hours * 3_600_000);

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    membership_id: membership.id,
    entry_type: "task",
    task_id: taskId,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
  });
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok(`${hours}h registradas`);
}

export async function deleteTaskEntry(orgId: string, entryId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const id = z.guid().parse(entryId);
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", id).eq("entry_type", "task");
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok("Registro eliminado");
}

const CORRECTION_ERRORS: Record<string, string> = {
  "corrections cannot end in the future": "No se pueden corregir horas que todavía no pasaron.",
  "only your own closed clock entries can be corrected": "Solo podés corregir tus propios fichajes ya cerrados.",
  "correction overlaps another clock entry": "Se superpone con otro fichaje tuyo de ese día.",
  "there is already a pending correction for that time": "Ya tenés una corrección pendiente para ese horario.",
  "a rejection requires a reason": "Contale a la persona por qué la rechazás.",
};

function correctionError(message: string | undefined) {
  const key = Object.keys(CORRECTION_ERRORS).find((k) => message?.includes(k));
  return key ? CORRECTION_ERRORS[key] : null;
}

/** Pide corregir un tramo de fichaje (entryId) o agregar uno olvidado. */
export async function requestCorrection(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await getOrgContext(orgId);
  const parsed = timeCorrectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { entryId, start, end, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("time_corrections").insert({
    membership_id: membership.id,
    entry_id: entryId ?? null,
    proposed_start: start,
    proposed_end: end,
    reason,
  });
  if (error) return fail(correctionError(error.message) ?? dbErrorMessage(error));
  refresh(orgId);
  return ok("Corrección enviada. Te avisamos cuando la revisen.");
}

export async function cancelCorrection(orgId: string, id: string): Promise<ActionState> {
  const { membership } = await getOrgContext(orgId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_corrections")
    .update({ status: "cancelled" })
    .eq("id", z.guid().parse(id))
    .eq("membership_id", membership.id)
    .eq("status", "pending")
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("La corrección ya no está pendiente.");
  refresh(orgId);
  return ok("Corrección cancelada");
}

export async function decideCorrection(orgId: string, id: string, decision: "approved" | "rejected", note?: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("time.view_team")) return fail("No tenés permisos para revisar fichajes del equipo.");
  const status = z.enum(["approved", "rejected"]).parse(decision);
  const parsedNote = decisionNoteSchema.safeParse(note ?? "");
  if (!parsedNote.success) return fail(parsedNote.error.issues[0].message);
  if (status === "rejected" && !parsedNote.data) return fail(CORRECTION_ERRORS["a rejection requires a reason"]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_corrections")
    .update({ status, decision_note: parsedNote.data || null })
    .eq("id", z.guid().parse(id))
    .eq("status", "pending")
    .select("id");
  if (error) return fail(correctionError(error.message) ?? dbErrorMessage(error));
  if (!data?.length) return fail("La corrección ya no está pendiente o no podés decidirla.");
  refresh(orgId);
  return ok(status === "approved" ? "Corrección aprobada y aplicada al fichaje" : "Corrección rechazada");
}
