import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, isRole, type Permission, type Role } from "@/lib/domain/permissions";
import type { Membership, Organization, Profile } from "@/lib/supabase/database.types";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
});

export type MembershipWithOrg = Membership & { organization: Organization };

export const getMyMemberships = cache(async (): Promise<MembershipWithOrg[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("*, organization:organizations(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as MembershipWithOrg[];
});

export interface OrgContext {
  userId: string;
  membership: Membership;
  organization: Organization;
  role: Role;
  can: (permission: Permission) => boolean;
}

/** Valida en servidor que el usuario pertenece a la org; si no, 404 (no revelamos que existe). */
export const getOrgContext = cache(async (orgId: string): Promise<OrgContext> => {
  const user = await requireUser();
  const memberships = await getMyMemberships();
  const current = memberships.find((m) => m.org_id === orgId);
  if (!current || !isRole(current.role_id)) notFound();

  const { organization, ...membership } = current;
  const role = current.role_id;
  return {
    userId: user.id,
    membership,
    organization,
    role,
    can: (permission) => hasPermission(role, permission),
  };
});

export async function requirePermission(orgId: string, permission: Permission) {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can(permission)) notFound();
  return ctx;
}
