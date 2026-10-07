"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { CONTACT_STATUSES } from "@/lib/domain/contact";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.object({ id: z.guid(), status: z.enum(CONTACT_STATUSES) });

/** Cambia el estado de un mensaje de la web (quién y cuándo lo registra la base). */
export async function setContactStatus(orgId: string, id: string, status: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("contact.manage")) return fail("No tenés permisos para gestionar los mensajes de la web.");
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return fail("Estado inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("org_id", orgId);
  if (error) return fail(dbErrorMessage(error));

  revalidatePath(`/app/${orgId}`, "layout");
  return ok();
}
