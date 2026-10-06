import "server-only";
import { cache } from "react";
import type { ISODate } from "@/lib/domain/periods";
import { createClient } from "@/lib/supabase/server";
import type { AbsenceRow, Holiday } from "@/lib/supabase/database.types";

export const getHolidays = cache(async (orgId: string, from: ISODate, to: ISODate): Promise<Holiday[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .eq("org_id", orgId)
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw error;
  return data ?? [];
});

/** Fechas de festivos como Set (para cálculos de días hábiles). */
export async function getHolidaySet(orgId: string, from: ISODate, to: ISODate): Promise<Set<string>> {
  return new Set((await getHolidays(orgId, from, to)).map((h) => h.date));
}

/** Vacaciones aprobadas de la org + pendientes propias o supervisadas (sin motivo). */
export const getAbsences = cache(async (orgId: string, from: ISODate, to: ISODate): Promise<AbsenceRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_absences", { p_org_id: orgId, p_from: from, p_to: to });
  if (error) throw error;
  return data ?? [];
});
