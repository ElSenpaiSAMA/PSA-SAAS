"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getEmployees } from "@/lib/data/employees";
import { getOrgContext } from "@/lib/data/session";
import { wouldCreateCycle } from "@/lib/domain/hierarchy";
import { isRole, outranks } from "@/lib/domain/permissions";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, invitationSchema, memberUpdateSchema } from "@/lib/validation/schemas";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

export async function inviteEmployee(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("employees.manage")) return fail("No tenés permisos para invitar.");
  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { email, role, managerId, position } = parsed.data;
  if (ctx.role !== "owner" && !outranks(ctx.role, role)) {
    return fail("No podés invitar con un rango igual o superior al tuyo.", { role: ["Rango no permitido"] });
  }

  const supabase = await createClient();
  const employees = await getEmployees(orgId);
  if (employees.some((e) => e.profile?.email?.toLowerCase() === email)) {
    return fail("Esa persona ya es parte de la organización.", { email: ["Ya es miembro"] });
  }

  const { error } = await supabase.from("invitations").insert({
    org_id: orgId,
    email,
    role_id: role,
    manager_id: managerId ?? null,
    position,
  });
  if (error) {
    if (error.code === "23505") return fail("Ya hay una invitación pendiente para ese email.", { email: ["Invitación pendiente"] });
    return fail(dbErrorMessage(error));
  }
  refresh(orgId);
  return ok(`Invitación enviada a ${email}`);
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("employees.manage")) return fail("No tenés permisos.");
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", z.guid().parse(invitationId)).eq("org_id", orgId);
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok("Invitación revocada");
}

export async function updateMember(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("employees.manage")) return fail("No tenés permisos para editar miembros.");
  const parsed = memberUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { membershipId, role, managerId, position, weeklyHours } = parsed.data;
  if (membershipId === ctx.membership.id) return fail("No podés editar tu propio rol desde acá.");

  const employees = await getEmployees(orgId);
  const target = employees.find((e) => e.id === membershipId);
  if (!target || !isRole(target.role_id)) return fail("Miembro no encontrado.");

  if (ctx.role !== "owner" && (!outranks(ctx.role, target.role_id) || !outranks(ctx.role, role))) {
    return fail("Tu rango no permite este cambio.", { role: ["Rango no permitido"] });
  }
  if (wouldCreateCycle(employees, membershipId, managerId ?? null)) {
    return fail("Esa asignación crearía un ciclo en el organigrama.", { managerId: ["Crearía un ciclo"] });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ role_id: role, manager_id: managerId ?? null, position, weekly_hours: weeklyHours })
    .eq("id", membershipId)
    .eq("org_id", orgId);
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok("Cambios guardados");
}
