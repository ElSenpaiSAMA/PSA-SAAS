"use server";

import { reportDbError } from "@/lib/errors/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

/** Marca una notificación como leída y devuelve su enlace para navegar. */
export async function openNotification(orgId: string, id: string): Promise<{ link: string | null }> {
  const ctx = await getOrgContext(orgId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", z.guid().parse(id))
    .eq("recipient_id", ctx.membership.id)
    .is("read_at", null)
    .select("link")
    .maybeSingle();
  refresh(orgId);
  if (data) return { link: data.link };
  // Ya estaba leída: igual devolvemos el enlace
  const { data: existing } = await supabase.from("notifications").select("link").eq("id", id).maybeSingle();
  return { link: existing?.link ?? null };
}

export async function markAllRead(orgId: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.membership.id)
    .is("read_at", null);
  if (error) return fail(await reportDbError(error));
  refresh(orgId);
  return ok("Todo marcado como leído");
}
