"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getEmployees } from "@/lib/data/employees";
import { getOrgContext } from "@/lib/data/session";
import { wouldCreateCycle } from "@/lib/domain/hierarchy";
import { isRole, outranks } from "@/lib/domain/permissions";
import { createClient } from "@/lib/supabase/server";
import { departmentSchema, fieldErrors, invitationSchema, memberUpdateSchema } from "@/lib/validation/schemas";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

export async function inviteEmployee(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("employees.manage")) return fail("No tenés permisos para invitar.");
  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { email, role, managerId, departmentId, position } = parsed.data;
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
    manager_id: departmentId ? null : (managerId ?? null),
    department_id: departmentId ?? null,
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

  const { membershipId, role, managerId, departmentId, position, weeklyHours } = parsed.data;
  if (membershipId === ctx.membership.id) return fail("No podés editar tu propio rol desde acá.");

  const employees = await getEmployees(orgId);
  const target = employees.find((e) => e.id === membershipId);
  if (!target || !isRole(target.role_id)) return fail("Miembro no encontrado.");

  if (ctx.role !== "owner" && (!outranks(ctx.role, target.role_id) || !outranks(ctx.role, role))) {
    return fail("Tu rango no permite este cambio.", { role: ["Rango no permitido"] });
  }
  // Si cambia de departamento, el manager lo define el responsable (trigger en la base)
  const departmentChanged = (departmentId ?? null) !== target.department_id;
  if (!departmentChanged && wouldCreateCycle(employees, membershipId, managerId ?? null)) {
    return fail("Esa asignación crearía un ciclo en el organigrama.", { managerId: ["Crearía un ciclo"] });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({
      role_id: role,
      manager_id: managerId ?? null,
      department_id: departmentId ?? null,
      position,
      weekly_hours: weeklyHours,
    })
    .eq("id", membershipId)
    .eq("org_id", orgId);
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok("Cambios guardados");
}

export async function saveDepartment(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("departments.manage")) return fail("No tenés permisos para gestionar departamentos.");
  const parsed = departmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));
  const departmentId = formData.get("departmentId");

  const supabase = await createClient();
  const values = { name: parsed.data.name, head_id: parsed.data.headId ?? null };
  const { error } =
    typeof departmentId === "string" && departmentId
      ? await supabase.from("departments").update(values).eq("id", z.guid().parse(departmentId)).eq("org_id", orgId)
      : await supabase.from("departments").insert({ ...values, org_id: orgId });
  if (error) {
    if (error.code === "23505") {
      return error.message.includes("head")
        ? fail("Esa persona ya es responsable de otro departamento.", { headId: ["Ya es responsable de otro"] })
        : fail("Ya existe un departamento con ese nombre.", { name: ["Nombre repetido"] });
    }
    return fail(dbErrorMessage(error));
  }
  refresh(orgId);
  return ok(departmentId ? "Departamento actualizado" : `Departamento "${parsed.data.name}" creado`);
}

export async function deleteDepartment(orgId: string, departmentId: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("departments.manage")) return fail("No tenés permisos para gestionar departamentos.");
  const supabase = await createClient();
  const { error } = await supabase.from("departments").delete().eq("id", z.guid().parse(departmentId)).eq("org_id", orgId);
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok("Departamento eliminado");
}
