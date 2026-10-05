import type { Metadata } from "next";
import { Crown, Mail, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getEmployees, getPendingInvitations } from "@/lib/data/employees";
import { getOrgContext } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { isRole } from "@/lib/domain/permissions";
import { InvitePanel } from "./invite-panel";
import { TeamView, type Person } from "./team-view";

export const metadata: Metadata = { title: "Equipo" };

export default async function EmployeesPage({ params }: PageProps<"/app/[orgId]/employees">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const canManage = ctx.can("employees.manage");
  const [employees, invitations] = await Promise.all([
    getEmployees(orgId),
    canManage ? getPendingInvitations(orgId) : Promise.resolve([]),
  ]);

  const people: Person[] = employees
    .filter((e) => e.status === "active" && isRole(e.role_id))
    .map((e) => ({
      id: e.id,
      name: displayName(e.profile),
      email: e.profile?.email ?? null,
      role: e.role_id,
      position: e.position,
      managerId: e.manager_id,
      weeklyHours: e.weekly_hours,
      isMe: e.id === ctx.membership.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const leads = new Set(people.map((p) => p.managerId).filter(Boolean)).size;

  return (
    <>
      <PageHeader title="Equipo" description={`Las personas de ${ctx.organization.name} y cómo se organizan.`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} label="Miembros activos" value={people.length} icon={Users} />
        <StatCard index={1} label="Personas con equipo a cargo" value={leads} icon={Crown} />
        <StatCard
          index={2}
          label="Invitaciones pendientes"
          value={invitations.length}
          icon={Mail}
          hint={canManage ? undefined : "Visible para administradores"}
        />
      </div>

      <div className={canManage ? "mt-6 grid gap-6 lg:grid-cols-[1fr_340px]" : "mt-6"}>
        <TeamView orgId={orgId} people={people} myRole={ctx.role} canManage={canManage} />
        {canManage ? (
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader title="Invitar a alguien" description="Con su rol y su manager desde el primer día" />
            <CardBody>
              <InvitePanel
                orgId={orgId}
                myRole={ctx.role}
                managers={people.map((p) => ({ id: p.id, name: p.name }))}
                pending={invitations.filter((i) => isRole(i.role_id)).map((i) => ({
                  id: i.id,
                  email: i.email,
                  role: i.role_id,
                  position: i.position,
                  createdAt: i.created_at,
                }))}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
