"use server";

import { reportDbError } from "@/lib/errors/server";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { mutedFromDisabledGroups } from "@/lib/domain/notification-prefs";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Lo único que cada persona cambia de su perfil es la foto (el superadmin, también sus
// avisos). El nombre y los avisos los gestiona administración (lo exige el guard de profiles).

/** Guarda (o quita) la foto ya subida a Storage. Solo se aceptan fotos de la carpeta propia. */
export async function setAvatar(orgId: string, url: string | null): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const ownFolder = `${env.supabaseUrl}/storage/v1/object/public/avatars/${ctx.userId}/`;
  if (url !== null && !url.startsWith(ownFolder)) return fail("La foto no es válida.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", ctx.userId);
  if (error) return fail(await reportDbError(error));
  revalidatePath(`/app/${orgId}`, "layout");
  return ok(url ? "Foto actualizada." : "Foto quitada.");
}

/** Avisos del superadmin: él elige los suyos (al resto se los configura administración). */
export async function setMyNotificationPrefs(orgId: string, disabledGroups: string[]): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("platform.manage")) return fail("Tus avisos los configura administración.");
  const muted = mutedFromDisabledGroups(disabledGroups.filter((g) => typeof g === "string").slice(0, 20));
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ muted_notifications: muted }).eq("id", ctx.userId);
  if (error) return fail(await reportDbError(error));
  revalidatePath(`/app/${orgId}/profile`);
  return ok("Avisos guardados.");
}
