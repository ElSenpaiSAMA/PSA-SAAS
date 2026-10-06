import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AutomationRule, AutomationRun, AutomationTemplate } from "@/lib/supabase/database.types";

export interface AutomationsOverview {
  templates: AutomationTemplate[];
  rules: AutomationRule[];
  /** Últimas ejecuciones (historial) */
  runs: AutomationRun[];
  /** Acciones por regla en los últimos 30 días */
  counts: Record<string, number>;
  lastRun: Record<string, string>;
}

/** RLS: reglas e historial solo con automations.manage. */
export const getAutomationsOverview = cache(async (orgId: string): Promise<AutomationsOverview> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [templates, rules, runs, recent] = await Promise.all([
    supabase.from("automation_templates").select("*"),
    supabase.from("automation_rules").select("*").eq("org_id", orgId),
    supabase.from("automation_runs").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(40),
    supabase.from("automation_runs").select("rule_key, created_at").eq("org_id", orgId).gte("created_at", since).limit(2000),
  ]);
  for (const r of [templates, rules, runs, recent]) if (r.error) throw r.error;

  const counts: Record<string, number> = {};
  const lastRun: Record<string, string> = {};
  for (const run of recent.data ?? []) {
    counts[run.rule_key] = (counts[run.rule_key] ?? 0) + 1;
    if (!lastRun[run.rule_key] || run.created_at > lastRun[run.rule_key]) lastRun[run.rule_key] = run.created_at;
  }
  return { templates: templates.data ?? [], rules: rules.data ?? [], runs: runs.data ?? [], counts, lastRun };
});
