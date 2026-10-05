import { AppShell } from "@/components/app/app-shell";
import { getMyMemberships, getOrgContext, getProfile } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { PERMISSIONS } from "@/lib/domain/permissions";

export default async function OrgLayout({ children, params }: LayoutProps<"/app/[orgId]">) {
  const { orgId } = await params;
  // Valida en servidor que el usuario pertenece a la org (404 si no)
  const ctx = await getOrgContext(orgId);
  const [memberships, profile] = await Promise.all([getMyMemberships(), getProfile(ctx.userId)]);

  return (
    <AppShell
      orgId={orgId}
      orgName={ctx.organization.name}
      role={ctx.role}
      permissions={PERMISSIONS.filter((p) => ctx.can(p))}
      user={{
        name: displayName(profile ? { full_name: profile.full_name, email: profile.email } : null),
        email: profile?.email ?? "",
        position: ctx.membership.position,
      }}
      organizations={memberships.map((m) => ({ id: m.org_id, name: m.organization.name, role: m.role_id }))}
    >
      {children}
    </AppShell>
  );
}
