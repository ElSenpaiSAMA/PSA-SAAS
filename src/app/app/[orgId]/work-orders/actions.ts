"use server";

import { reportDbError } from "@/lib/errors/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { addMonths, monthEnd, monthStart, nextPeriod, parseMonthParam, shiftPeriod } from "@/lib/domain/periods";
import { missingContinuations, titleForPeriod } from "@/lib/domain/work-orders";
import { createClient } from "@/lib/supabase/server";
import {
  billingStatusSchema,
  duplicateWorkOrderSchema,
  fieldErrors,
  workOrderSchema,
  workOrderStatusSchema,
} from "@/lib/validation/schemas";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

export async function createWorkOrder(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = workOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      project_id: v.projectId,
      title: v.title,
      period_start: v.periodStart,
      period_end: v.periodEnd,
      budgeted_hours: v.budgetedHours ?? null,
      // Sin tarifa explícita, la base hereda la del proyecto
      ...(v.hourlyRate !== undefined ? { hourly_rate: v.hourlyRate } : {}),
    })
    .select("id")
    .single();
  if (error || !data) return fail(await reportDbError(error));
  refresh(orgId);
  redirect(`/app/work-orders/${data.id}`);
}

export async function setWorkOrderStatus(orgId: string, workOrderId: string, status: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = workOrderStatusSchema.safeParse(status);
  if (!parsed.success) return fail("Estado inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .update({ status: parsed.data })
    .eq("id", z.guid().parse(workOrderId))
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("No tenés permisos para cambiar esta OT.");
  refresh(orgId);
  return ok("Estado actualizado");
}

export async function setBillingStatus(orgId: string, workOrderId: string, billing: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("billing.manage")) return fail("No tenés permisos de facturación.");
  const parsed = billingStatusSchema.safeParse(billing);
  if (!parsed.success) return fail("Estado inválido.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_orders")
    .update({ billing_status: parsed.data })
    .eq("id", z.guid().parse(workOrderId))
    .eq("org_id", orgId);
  if (error) return fail(await reportDbError(error));
  refresh(orgId);
  return ok(parsed.data === "invoiced" ? "OT marcada como facturada" : "Facturación revertida");
}

export async function duplicateWorkOrder(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = duplicateWorkOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("duplicate_work_order", {
    p_work_order_id: parsed.data.workOrderId,
    p_title: parsed.data.title,
    p_period_start: parsed.data.periodStart,
    p_period_end: parsed.data.periodEnd,
  });
  if (error || !newId) return fail(await reportDbError(error));
  refresh(orgId);
  redirect(`/app/work-orders/${newId}`);
}

/** "Copiar a otro mes": mismo período corrido N meses (1 = el siguiente), título actualizado. */
export async function copyToNextPeriod(orgId: string, workOrderId: string, months = 1): Promise<ActionState> {
  await getOrgContext(orgId);
  const shift = z.number().int().min(1).max(12).parse(months);
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", z.guid().parse(workOrderId))
    .maybeSingle();
  if (!source) return fail("OT no encontrada.");

  const next = shiftPeriod(source.period_start, source.period_end, shift);
  const { data: newId, error } = await supabase.rpc("duplicate_work_order", {
    p_work_order_id: source.id,
    p_title: titleForPeriod(source.title, source.period_start, next.start),
    p_period_start: next.start,
    p_period_end: next.end,
  });
  if (error || !newId) return fail(await reportDbError(error));
  refresh(orgId);
  redirect(`/app/work-orders/${newId}`);
}

/**
 * Repite el mes anterior: copia al mes indicado cada OT del mes previo cuyo
 * proyecto todavía no tiene OT en ese mes. La base valida permisos por OT.
 */
export async function copyPreviousMonth(orgId: string, month: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const target = parseMonthParam(month);
  if (!target) return fail("Mes inválido.");
  const previous = addMonths(target, -1);

  const supabase = await createClient();
  const [prev, current] = await Promise.all([
    supabase.from("work_orders").select("*").eq("org_id", orgId).gte("period_start", previous).lte("period_start", monthEnd(previous)),
    supabase.from("work_orders").select("project_id, period_start").eq("org_id", orgId).gte("period_start", target).lte("period_start", monthEnd(target)),
  ]);
  if (prev.error || current.error) return fail(await reportDbError(prev.error ?? current.error));

  const pending = missingContinuations(prev.data ?? [], current.data ?? [], monthStart(target));
  if (!pending.length) return ok("No hay OT pendientes de copiar.");

  let copied = 0;
  for (const source of pending) {
    const next = nextPeriod(source.period_start, source.period_end);
    const { error } = await supabase.rpc("duplicate_work_order", {
      p_work_order_id: source.id,
      p_title: titleForPeriod(source.title, source.period_start, next.start),
      p_period_start: next.start,
      p_period_end: next.end,
    });
    if (!error) copied++;
  }
  if (!copied) return fail("No se pudo copiar ninguna OT. Revisá tus permisos sobre esos proyectos.");
  refresh(orgId);
  const skipped = pending.length - copied;
  return ok(
    `${copied} ${copied === 1 ? "OT copiada" : "OT copiadas"} con sus tareas${skipped ? ` (${skipped} sin permisos)` : ""}`,
  );
}

export async function duplicateTask(orgId: string, taskId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", z.guid().parse(taskId)).maybeSingle();
  if (!task) return fail("Tarea no encontrada.");

  const { error } = await supabase.from("tasks").insert({
    project_id: task.project_id,
    work_order_id: task.work_order_id,
    title: `${task.title} (copia)`,
    description: task.description,
    assigned_to: task.assigned_to,
    estimated_hours: task.estimated_hours,
    start_date: task.start_date,
    due_date: task.due_date,
  });
  if (error) return fail(await reportDbError(error));
  refresh(orgId);
  return ok("Tarea duplicada");
}
