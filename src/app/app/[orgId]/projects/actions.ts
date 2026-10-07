"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getHeadedDepartmentId } from "@/lib/data/departments";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  projectMemberSchema,
  projectSchema,
  taskEditSchema,
  taskSchema,
  taskStatusSchema,
} from "@/lib/validation/schemas";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

/** Chequeo autoritativo en la base (misma función que usan las políticas RLS). */
async function canManageProject(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_project", { p_project_id: projectId });
  return data === true;
}

export async function createProject(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const departmentId = parsed.data.departmentId ?? null;
  if (!ctx.can("projects.manage")) {
    const headed = await getHeadedDepartmentId(orgId, ctx.membership.id);
    if (!headed) return fail("No tenés permisos para crear proyectos.");
    if (departmentId !== headed) {
      return fail("Solo podés crear proyectos en tu departamento.", { departmentId: ["Elegí tu departamento"] });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    org_id: orgId,
    name: parsed.data.name,
    client_name: parsed.data.clientName,
    budgeted_hours: parsed.data.budgetedHours ?? null,
    hourly_rate: parsed.data.hourlyRate ?? null,
    department_id: departmentId,
  });
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok(`Proyecto "${parsed.data.name}" creado`);
}

export async function setProjectStatus(orgId: string, projectId: string, status: "active" | "archived"): Promise<ActionState> {
  await getOrgContext(orgId);
  const id = z.guid().parse(projectId);
  if (!(await canManageProject(id))) return fail("No tenés permisos para editar este proyecto.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: z.enum(["active", "archived"]).parse(status) })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok(status === "archived" ? "Proyecto archivado" : "Proyecto reactivado");
}

export async function addProjectMember(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = projectMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Elegí a una persona.", fieldErrors(parsed.error));
  if (!(await canManageProject(parsed.data.projectId))) return fail("No tenés permisos para gestionar este proyecto.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .insert({ project_id: parsed.data.projectId, membership_id: parsed.data.membershipId });
  if (error) return fail(error.code === "23505" ? "Ya es miembro del proyecto." : dbErrorMessage(error));
  refresh(orgId);
  return ok("Miembro agregado");
}

export async function removeProjectMember(orgId: string, projectId: string, membershipId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = projectMemberSchema.parse({ projectId, membershipId });
  if (!(await canManageProject(parsed.projectId))) return fail("No tenés permisos para gestionar este proyecto.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", parsed.projectId)
    .eq("membership_id", parsed.membershipId);
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok("Miembro quitado");
}

export async function createTask(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));
  if (!(await canManageProject(parsed.data.projectId))) return fail("No tenés permisos para crear tareas en este proyecto.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    project_id: parsed.data.projectId,
    work_order_id: parsed.data.workOrderId ?? null,
    title: parsed.data.title,
    assigned_to: parsed.data.assignedTo ?? null,
    estimated_hours: parsed.data.estimatedHours ?? null,
    start_date: parsed.data.startDate ?? null,
    due_date: parsed.data.dueDate ?? null,
  });
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok("Tarea creada");
}

export async function updateTaskStatus(orgId: string, taskId: string, status: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsedStatus = taskStatusSchema.safeParse(status);
  if (!parsedStatus.success) return fail("Estado inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: parsedStatus.data })
    .eq("id", z.guid().parse(taskId))
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail("Solo podés mover tus propias tareas.");
  refresh(orgId);
  return ok("Tarea actualizada");
}

export async function updateTask(orgId: string, taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = taskEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      assigned_to: parsed.data.assignedTo ?? null,
      estimated_hours: parsed.data.estimatedHours ?? null,
      start_date: parsed.data.startDate ?? null,
      due_date: parsed.data.dueDate ?? null,
    })
    .eq("id", z.guid().parse(taskId))
    .eq("org_id", orgId)
    .select("id");
  if (error) {
    if (error.message.includes("only status can be changed")) return fail("Solo quien gestiona el proyecto puede editar la tarea.");
    return fail(dbErrorMessage(error));
  }
  if (!data?.length) return fail("No tenés permisos para editar esta tarea.");
  refresh(orgId);
  return ok("Tarea actualizada");
}

export async function deleteTask(orgId: string, taskId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", z.guid().parse(taskId)).eq("org_id", orgId).select("id");
  if (error) {
    if (error.message.includes("task has logged hours")) {
      return fail("Tiene horas imputadas: no se puede borrar. Marcala como hecha.");
    }
    return fail(dbErrorMessage(error));
  }
  if (!data?.length) return fail("No tenés permisos para borrar esta tarea.");
  refresh(orgId);
  return ok("Tarea borrada");
}
