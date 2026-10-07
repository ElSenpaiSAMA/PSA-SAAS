"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { FUNCTION_PERMISSIONS } from "@/lib/domain/permissions";
import { reportDbError } from "@/lib/errors/server";
import { createClient } from "@/lib/supabase/server";

const functionKey = z.enum(FUNCTION_PERMISSIONS.map((p) => p.key) as [string, ...string[]]);

/** Da o quita una función de empresa a una rama o a un departamento. Solo la plataforma. */
export async function setUnitPermission(
  orgId: string,
  unit: "branch" | "department",
  unitId: string,
  permission: string,
  enabled: boolean,
): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("platform.manage")) return fail("Solo la plataforma configura la estructura.");
  const id = z.guid().parse(unitId);
  const key = functionKey.parse(permission) as (typeof FUNCTION_PERMISSIONS)[number]["key"];

  const supabase = await createClient();
  const { error } =
    unit === "branch"
      ? enabled
        ? await supabase.from("branch_permissions").upsert({ branch_id: id, permission_key: key }, { ignoreDuplicates: true })
        : await supabase.from("branch_permissions").delete().eq("branch_id", id).eq("permission_key", key)
      : enabled
        ? await supabase.from("department_permissions").upsert({ department_id: id, permission_key: key }, { ignoreDuplicates: true })
        : await supabase.from("department_permissions").delete().eq("department_id", id).eq("permission_key", key);
  if (error) return fail(await reportDbError(error));
  revalidatePath(`/app/${orgId}`, "layout");
  return ok();
}

const branchSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  color: z.enum(["blue", "green", "violet", "amber", "rose", "teal"]),
});

export async function createBranch(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("platform.manage")) return fail("Solo la plataforma configura la estructura.");
  const parsed = branchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá el nombre.", { name: parsed.error.issues.map((i) => i.message) });

  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({ org_id: orgId, name: parsed.data.name, color: parsed.data.color });
  if (error) {
    if (error.code === "23505") return fail("Ya hay una rama con ese nombre.", { name: ["Nombre repetido"] });
    return fail(await reportDbError(error));
  }
  revalidatePath(`/app/${orgId}`, "layout");
  return ok(`Rama "${parsed.data.name}" creada`);
}
