"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { AUTOMATION_BY_KEY, parseParams } from "@/lib/domain/automations";
import { createClient } from "@/lib/supabase/server";

async function guard(orgId: string, key: string) {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("automations.manage")) return "No tenés permisos para configurar automatizaciones.";
  if (!AUTOMATION_BY_KEY.has(key)) return "Automatización desconocida.";
  return null;
}

/** Guarda la configuración completa de una regla (estado + parámetros). */
async function upsertRule(orgId: string, key: string, patch: { enabled?: boolean; params?: Record<string, number> }) {
  const supabase = await createClient();
  const [{ data: current }, { data: template }] = await Promise.all([
    supabase.from("automation_rules").select("*").eq("org_id", orgId).eq("key", key).maybeSingle(),
    supabase.from("automation_templates").select("*").eq("key", key).single(),
  ]);
  return supabase.from("automation_rules").upsert(
    {
      org_id: orgId,
      key,
      enabled: patch.enabled ?? current?.enabled ?? template?.default_enabled ?? false,
      params: { ...(current?.params ?? {}), ...(patch.params ?? {}) },
    },
    { onConflict: "org_id,key" },
  );
}

export async function setAutomationEnabled(orgId: string, key: string, enabled: boolean): Promise<ActionState> {
  const denied = await guard(orgId, key);
  if (denied) return fail(denied);
  const { error } = await upsertRule(orgId, key, { enabled });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/app/${orgId}/automations`);
  return ok(enabled ? "Automatización activada" : "Automatización desactivada");
}

export async function saveAutomationParams(orgId: string, key: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard(orgId, key);
  if (denied) return fail(denied);
  const parsed = parseParams(key, Object.fromEntries(formData));
  if (!parsed.ok) {
    return fail("Revisá los valores marcados.", Object.fromEntries(Object.entries(parsed.errors).map(([k, v]) => [k, [v]])));
  }
  const { error } = await upsertRule(orgId, key, { params: parsed.params });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/app/${orgId}/automations`);
  return ok("Configuración guardada");
}

export async function runAutomationNow(orgId: string, key: string): Promise<ActionState> {
  const denied = await guard(orgId, key);
  if (denied) return fail(denied);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_automation_now", { p_org_id: orgId, p_key: key });
  if (error) {
    return fail(error.message.includes("disabled") ? "Activala primero para poder ejecutarla." : dbErrorMessage(error));
  }
  revalidatePath(`/app/${orgId}`, "layout");
  const n = Number(data ?? 0);
  return ok(n === 0 ? "Ejecutada: no había nada que hacer" : `Ejecutada: ${n} ${n === 1 ? "acción" : "acciones"}`);
}
