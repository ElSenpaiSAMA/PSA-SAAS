"use server";

import { reportDbError } from "@/lib/errors/server";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, orgSettingsSchema } from "@/lib/validation/schemas";

export async function saveOrgSettings(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("employees.manage")) return fail("No tenés permisos para cambiar los ajustes de la empresa.");
  const parsed = orgSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      default_annual_vacation_days: parsed.data.defaultAnnualVacationDays,
      default_weekly_hours: parsed.data.defaultWeeklyHours,
      timezone: parsed.data.timezone,
    })
    .eq("id", orgId)
    .select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("No se pudieron guardar los ajustes.");
  // El nombre aparece en el menú de todas las páginas
  revalidatePath(`/app/${orgId}`, "layout");
  return ok("Ajustes guardados");
}
