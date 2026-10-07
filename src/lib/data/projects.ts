import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectMember, Task } from "@/lib/supabase/database.types";

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

/** Minutos imputados por tarea (agregados en la base, sin exponer registros individuales). */
export const getTaskMinutes = cache(async (orgId: string): Promise<Map<string, number>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_logged_minutes", { p_org_id: orgId });
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.task_id, r.minutes]));
});

export const getProject = cache(async (projectId: string): Promise<Project | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  return data;
});

/** Membresías de proyectos visibles para el usuario (RLS filtra el resto). */
export const getProjectMembers = cache(async (orgId: string): Promise<ProjectMember[]> => {
  const supabase = await createClient();
  const projects = await getProjects(orgId);
  if (projects.length === 0) return [];
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .in(
      "project_id",
      projects.map((p) => p.id),
    );
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
