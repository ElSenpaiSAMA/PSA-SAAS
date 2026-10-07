"use server";

import { reportDbError } from "@/lib/errors/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/schemas";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

/** Mover una tarea en el calendario (la base valida que el usuario gestione el proyecto). */
export async function moveTask(orgId: string, taskId: string, startDate: string | null, dueDate: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = z
    .object({ id: z.guid(), start: isoDate.nullable(), due: isoDate })
    .refine((v) => !v.start || v.due >= v.start)
    .safeParse({ id: taskId, start: startDate, due: dueDate });
  if (!parsed.success) return fail("Fechas inválidas.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ start_date: parsed.data.start, due_date: parsed.data.due })
    .eq("id", parsed.data.id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("No podés mover esta tarea.");
  refresh(orgId);
  return ok("Tarea reprogramada");
}

const holidaySchema = z.object({
  date: isoDate,
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
});

export async function addHoliday(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("holidays.manage")) return fail("No tenés permisos para gestionar festivos.");
  const parsed = holidaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({ org_id: orgId, ...parsed.data });
  if (error) {
    if (error.code === "23505") return fail("Ya hay un festivo ese día.", { date: ["Día ocupado"] });
    return fail(await reportDbError(error));
  }
  refresh(orgId);
  return ok(`Festivo "${parsed.data.name}" agregado`);
}

export async function deleteHoliday(orgId: string, holidayId: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("holidays.manage")) return fail("No tenés permisos para gestionar festivos.");
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("id", z.guid().parse(holidayId)).eq("org_id", orgId);
  if (error) return fail(await reportDbError(error));
  refresh(orgId);
  return ok("Festivo eliminado");
}
