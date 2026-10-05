import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Project, Task } from "@/lib/supabase/database.types";

export const getProjects = cache(async (orgId: string): Promise<Project[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", orgId)
    .order("status")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

export const getTasks = cache(async (orgId: string): Promise<Task[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
});
