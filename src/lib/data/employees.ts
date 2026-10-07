import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Invitation, Membership, Profile } from "@/lib/supabase/database.types";

export type Employee = Membership & { profile: Pick<Profile, "full_name" | "email" | "avatar_url"> | null };

export const getEmployees = cache(async (orgId: string): Promise<Employee[]> => {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("*")
    .eq("org_id", orgId)
    // El superadmin es la plataforma, no una persona de la empresa: no aparece en listados
    .neq("role_id", "superadmin")
    .order("created_at");
  if (error) throw error;

  const userIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds)
    : { data: [] as Pick<Profile, "id" | "full_name" | "email" | "avatar_url">[] };

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (memberships ?? []).map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null }));
});

export const getPendingInvitations = cache(async (orgId: string): Promise<Invitation[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
});
