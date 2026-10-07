"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

/** Marca un error como resuelto (o lo reabre). Quién y cuándo lo pone la base. */
export async function setErrorResolved(orgId: string, id: string, resolved: boolean): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("platform.manage")) return fail("Solo la plataforma gestiona el registro de errores.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("error_logs")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", z.guid().parse(id));
  // Acá no se usa reportDbError: si falla el registro de errores, registrarlo ahí no ayuda
  if (error) return fail("No se pudo actualizar el error.");
  revalidatePath(`/app/${orgId}/errors`);
  return ok(resolved ? "Marcado como resuelto" : "Reabierto");
}
