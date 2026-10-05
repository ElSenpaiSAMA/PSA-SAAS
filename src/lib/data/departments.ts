import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Department } from "@/lib/supabase/database.types";

export const getDepartments = cache(async (orgId: string): Promise<Department[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("*").eq("org_id", orgId).order("name");
  if (error) throw error;
  return data ?? [];
});

/** Departamento que encabeza esta membership, si alguno. */
export async function getHeadedDepartmentId(orgId: string, membershipId: string): Promise<string | null> {
  const departments = await getDepartments(orgId);
  return departments.find((d) => d.head_id === membershipId)?.id ?? null;
}
