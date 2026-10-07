import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog, EmployeeRecord, TimeEntry, VacationRequest } from "@/lib/supabase/database.types";

/** Versiones de la ficha (RLS: la propia persona o people.sensitive; si no, vacío). */
export const getEmployeeRecords = cache(async (membershipId: string): Promise<EmployeeRecord[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_records")
    .select("*")
    .eq("membership_id", membershipId)
    .order("effective_from", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

/** Registros de tiempo de una persona en un rango (RLS: propia o línea de reporte). */
export const getMemberEntries = cache(async (membershipId: string, fromIso: string, toIso: string): Promise<TimeEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("membership_id", membershipId)
    .gte("started_at", fromIso)
    .lt("started_at", toIso)
    .order("started_at");
  if (error) throw error;
  return data ?? [];
});

export const getMemberVacations = cache(async (membershipId: string): Promise<VacationRequest[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vacation_requests")
    .select("*")
    .eq("membership_id", membershipId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

/**
 * Actividad de y sobre una persona en un rango: lo que hizo (actor) y los
 * cambios en su membresía, su ficha y sus registros (RLS: auditoría de la org).
 */
export async function getMemberAudit(
  orgId: string,
  person: { userId: string; membershipId: string; recordIds: string[] },
  fromIso: string,
  toIso: string,
  limit = 60,
): Promise<AuditLog[]> {
  const supabase = await createClient();
  const about = [person.membershipId, ...person.recordIds].map((id) => `"${id}"`).join(",");
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("org_id", orgId)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .or(`user_id.eq.${person.userId},record_id.in.(${about}),new_data->>membership_id.eq.${person.membershipId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
