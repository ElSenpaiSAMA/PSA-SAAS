"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, projectSchema, taskSchema, taskStatusSchema } from "@/lib/validation/schemas";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

export async function createProject(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("projects.manage")) return fail("No tenés permisos para crear proyectos.");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    org_id: orgId,
    name: parsed.data.name,
    client_name: parsed.data.clientName,
    budgeted_hours: parsed.data.budgetedHours ?? null,
  });
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok(`Proyecto "${parsed.data.name}" creado`);
}

export async function setProjectStatus(orgId: string, projectId: string, status: "active" | "archived"): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("projects.manage")) return fail("No tenés permisos para editar proyectos.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: z.enum(["active", "archived"]).parse(status) })
    .eq("id", z.guid().parse(projectId))
    .eq("org_id", orgId);
  if (error) return fail(dbErrorMessage(error));
  refresh(orgId);
  return ok(status === "archived" ? "Proyecto archivado" : "Proyecto reactivado");
}

export async function createTask(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("tasks.manage_all")) return fail("No tenés permisos para crear tareas.");
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    project_id: parsed.data.projectId,
    title: parsed.data.title,
    assigned_to: parsed.data.assignedTo ?? null,
    estimated_hours: parsed.data.estimatedHours ?? null,
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
