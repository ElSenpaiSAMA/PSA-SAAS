"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { employeeRecordSchema, fieldErrors } from "@/lib/validation/schemas";

/**
 * Registra un cambio en la ficha: crea una versión vigente desde la fecha
 * indicada. Si ya hay una versión con esa misma fecha, la corrige.
 * RLS exige people.sensitive; el control en la UI es solo de presentación.
 */
export async function saveEmployeeRecord(
  orgId: string,
  membershipId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("people.sensitive")) return fail("No tenés permisos para editar datos personales.");
  const parsed = employeeRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { effectiveFrom, ...values } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("employee_records").upsert(
    {
      membership_id: z.guid().parse(membershipId),
      org_id: orgId,
      effective_from: effectiveFrom,
      ...values,
    },
    { onConflict: "membership_id,effective_from" },
  );
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/app/${orgId}/staff/${membershipId}`);
  return ok("Ficha actualizada");
}
