import "server-only";
import { cache } from "react";
import type { ISODate } from "@/lib/domain/periods";
import { createClient } from "@/lib/supabase/server";
import type { WorkOrder, WorkloadItemRow } from "@/lib/supabase/database.types";

/** OT visibles (RLS) cuyo período se superpone con [from, to]. */
export const getWorkOrdersInRange = cache(async (orgId: string, from: ISODate, to: ISODate): Promise<WorkOrder[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select("*")
    .eq("org_id", orgId)
    .lte("period_start", to)
    .gte("period_end", from)
    .order("period_start")
    .order("number");
  if (error) throw error;
  return data ?? [];
});

export const getProjectWorkOrders = cache(async (projectId: string): Promise<WorkOrder[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select("*")
    .eq("project_id", projectId)
    .order("period_start", { ascending: false })
    .order("number", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

export const getWorkOrder = cache(async (id: string): Promise<WorkOrder | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("work_orders").select("*").eq("id", id).maybeSingle();
  return data;
});

/** Todas las OT visibles de la org (para saber si una tarea admite horas). */
export const getAllWorkOrders = cache(async (orgId: string): Promise<WorkOrder[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("work_orders").select("*").eq("org_id", orgId);
  if (error) throw error;
  return data ?? [];
});

export const getWorkloadItems = cache(async (orgId: string, from: ISODate, to: ISODate): Promise<WorkloadItemRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("workload_items", { p_org_id: orgId, p_from: from, p_to: to });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, estimated_hours: Number(r.estimated_hours) }));
});
