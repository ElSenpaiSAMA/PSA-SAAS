"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { mutedFromDisabledGroups } from "@/lib/domain/notification-prefs";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// La base valida todo de nuevo (guard de profiles); esto da mensajes claros.

const nameSchema = z.object({
  fullName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
});

export async function updateProfile(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const parsed = nameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return fail("Revisá el nombre.", { fullName: parsed.error.issues.map((i) => i.message) });

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", ctx.userId);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/app/${orgId}`, "layout");
  return ok("Perfil actualizado.");
}

/** Guarda (o quita) la foto ya subida a Storage. Solo se aceptan fotos de la carpeta propia. */
export async function setAvatar(orgId: string, url: string | null): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const ownFolder = `${env.supabaseUrl}/storage/v1/object/public/avatars/${ctx.userId}/`;
  if (url !== null && !url.startsWith(ownFolder)) return fail("La foto no es válida.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", ctx.userId);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/app/${orgId}`, "layout");
  return ok(url ? "Foto actualizada." : "Foto quitada.");
}

/** Los grupos de avisos que la persona apagó. Lo que pide una acción no se puede silenciar. */
export async function setNotificationPrefs(orgId: string, disabledGroups: string[]): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const muted = mutedFromDisabledGroups(z.array(z.string().max(40)).max(20).parse(disabledGroups));

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ muted_notifications: muted }).eq("id", ctx.userId);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/app/${orgId}/profile`);
  return ok("Preferencias guardadas.");
}
