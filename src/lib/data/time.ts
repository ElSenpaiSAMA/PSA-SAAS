import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { startOfWeek } from "@/lib/domain/time";
import type { TimeCorrection, TimeEntry } from "@/lib/supabase/database.types";

export type TimeEntryWithTask = TimeEntry & {
  task: { id: string; title: string; project: { id: string; name: string } | null } | null;
};

export const getMyEntriesSince = cache(
  async (membershipId: string, sinceIso: string): Promise<TimeEntryWithTask[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("time_entries")
      .select("*, task:tasks(id, title, project:projects(id, name))")
      .eq("membership_id", membershipId)
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as TimeEntryWithTask[];
  },
);

export const getOpenClock = cache(async (membershipId: string): Promise<TimeEntry | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .eq("membership_id", membershipId)
    .eq("entry_type", "clock")
    .is("ended_at", null)
    .maybeSingle();
  return data;
});

/** Entradas de la semana actual de varias personas (RLS filtra a lo que se puede ver). */
export const getWeekEntriesFor = cache(async (membershipIds: string[]): Promise<TimeEntry[]> => {
  if (membershipIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .in("membership_id", membershipIds)
    .gte("started_at", startOfWeek(new Date()).toISOString());
  if (error) throw error;
  return data ?? [];
});

export const getTaskEntriesForOrg = cache(async (taskIds: string[]): Promise<TimeEntry[]> => {
  if (taskIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("entry_type", "task")
    .in("task_id", taskIds);
  if (error) throw error;
  return data ?? [];
});

/** Correcciones visibles (RLS: propias o de la línea de reporte), más recientes primero. */
export const getCorrections = cache(async (membershipIds: string[]): Promise<TimeCorrection[]> => {
  if (membershipIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_corrections")
    .select("*")
    .in("membership_id", membershipIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
});

/** Tramos por id (RLS: propios o de la línea de reporte). */
export async function getTimeEntriesById(ids: string[]): Promise<Map<string, TimeEntry>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("time_entries").select("*").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((e) => [e.id, e]));
}

/** Mis registros entre dos instantes (para el registro semanal). */
export const getMyEntriesBetween = cache(
  async (membershipId: string, fromIso: string, toIso: string): Promise<TimeEntryWithTask[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("time_entries")
      .select("*, task:tasks(id, title, project:projects(id, name))")
      .eq("membership_id", membershipId)
      .gte("started_at", fromIso)
      .lt("started_at", toIso)
      .order("started_at");
    if (error) throw error;
    return (data ?? []) as unknown as TimeEntryWithTask[];
  },
);

/** Mis ausencias aprobadas que tocan el período (con su tipo, para el registro). */
export const getMyApprovedAbsences = cache(async (membershipId: string, from: string, to: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vacation_requests")
    .select("start_date, end_date, kind")
    .eq("membership_id", membershipId)
    .eq("status", "approved")
    .lte("start_date", to)
    .gte("end_date", from);
  if (error) throw error;
  return data ?? [];
});
