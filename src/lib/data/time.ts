import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { startOfWeek } from "@/lib/domain/time";
import type { TimeEntry } from "@/lib/supabase/database.types";

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
