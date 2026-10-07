import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ErrorLog } from "@/lib/supabase/database.types";

export type ErrorFilter = "open" | "resolved" | "all";

export function isErrorFilter(value: unknown): value is ErrorFilter {
  return value === "open" || value === "resolved" || value === "all";
}

/** RLS: solo el superadmin lee el registro de errores. */
export const getErrorLogs = cache(async (filter: ErrorFilter): Promise<ErrorLog[]> => {
  const supabase = await createClient();
  let query = supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(300);
  if (filter === "open") query = query.is("resolved_at", null);
  if (filter === "resolved") query = query.not("resolved_at", "is", null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
});

/** Cuántos errores hay sin resolver y en las últimas 24 horas (para los indicadores). */
export const getErrorCounts = cache(async (): Promise<{ open: number; last24h: number }> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [open, recent] = await Promise.all([
    supabase.from("error_logs").select("id", { count: "exact", head: true }).is("resolved_at", null),
    supabase.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  return { open: open.count ?? 0, last24h: recent.count ?? 0 };
});
