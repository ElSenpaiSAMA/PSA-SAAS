import { AppShell } from "@/components/app/app-shell";
import { aiEnabled } from "@/lib/ai/openrouter";
import { getContactNewCount } from "@/lib/data/contact";
import { fallback } from "@/lib/errors/server";
import { getForumUnreadCount } from "@/lib/data/forum";
import { getPending, getUnreadCount } from "@/lib/data/inbox";
import { getMyMemberships, getOrgContext, getProfile } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { PERMISSIONS } from "@/lib/domain/permissions";

export default async function OrgLayout({ children, params }: LayoutProps<"/app/[orgId]">) {
  const { orgId } = await params;
  // Valida en servidor que el usuario pertenece a la org (404 si no)
  const ctx = await getOrgContext(orgId);
  const [memberships, profile, pending, unread, forumUnread, contactNew] = await Promise.all([
    getMyMemberships(),
    getProfile(ctx.userId),
    // Un contador nunca tumba la app: si falla, no se muestra (y queda en el registro de errores)
    getPending(orgId).catch(fallback([], "pendientes de la bandeja")),
    getUnreadCount(ctx.membership.id).catch(fallback(0, "avisos sin leer")),
    getForumUnreadCount(orgId).catch(fallback(0, "novedades del foro")),
    ctx.can("contact.manage") ? getContactNewCount(orgId).catch(fallback(0, "mensajes web nuevos")) : 0,
  ]);

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
        avatar: profile?.avatar_url ?? null,
      }}
      badges={{ inbox: pending.length + unread, forum: forumUnread, contact: contactNew }}
      aiEnabled={aiEnabled()}
      organizations={memberships.map((m) => ({ id: m.org_id, name: m.organization.name, role: m.role_id }))}
    >
      {children}
    </AppShell>
  );
}
