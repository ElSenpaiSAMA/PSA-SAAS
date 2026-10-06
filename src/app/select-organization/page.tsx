import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { getMyMemberships, getProfile, requireUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/domain/hierarchy";
import { signOut } from "../(auth)/actions";
import { OrgPicker, type PendingInvitation } from "./org-picker";

export const metadata: Metadata = { title: "Elegí tu organización" };

export default async function SelectOrganizationPage({ searchParams }: PageProps<"/select-organization">) {
  const user = await requireUser();
  const { error, new: forceNew } = await searchParams;
  const [memberships, profile] = await Promise.all([getMyMemberships(), getProfile(user.id)]);

  const supabase = await createClient();
  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, role_id, position, organization:organizations(id, name)")
    .is("accepted_at", null)
    // Solo las invitaciones a mi email: un admin ve por RLS todas las de su empresa
    .ilike("email", (user.email ?? "").replace(/[%_\\]/g, "\\$&"));

  const pending = (invitations ?? []) as unknown as PendingInvitation[];

  // Una sola organización y nada pendiente: entrar directo
  if (memberships.length === 1 && pending.length === 0 && !forceNew && !error) {
    redirect(`/app/${memberships[0].org_id}/dashboard`);
  }

  const name = displayName(profile ? { full_name: profile.full_name, email: profile.email ?? user.email ?? null } : null);

  return (
    <div className="relative min-h-dvh">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 pt-10 pb-24 sm:pt-16">
        <OrgPicker
          name={name.split(" ")[0]}
          memberships={memberships.map((m) => ({
            orgId: m.org_id,
            orgName: m.organization.name,
            role: m.role_id,
            position: m.position,
          }))}
          invitations={pending}
          invitationError={error === "invitation"}
        />
      </main>
    </div>
  );
}
