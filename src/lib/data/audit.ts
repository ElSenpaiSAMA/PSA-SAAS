import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/lib/supabase/database.types";

export async function getAuditLog(orgId: string, limit = 100): Promise<AuditLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
