import type { Metadata } from "next";
import { Building2, Mail, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getBranches, getDepartments } from "@/lib/data/departments";
import { getEmployees, getPendingInvitations } from "@/lib/data/employees";
import { getProjects } from "@/lib/data/projects";
import { requirePermission } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { isRole } from "@/lib/domain/permissions";
import type { DepartmentInfo } from "./departments-view";
import { InvitePanel } from "./invite-panel";
import { TeamView, type Person } from "./team-view";

export const metadata: Metadata = { title: "Personas" };

export default async function PeoplePage({ params }: PageProps<"/app/[orgId]/employees">) {
  const { orgId } = await params;
  const ctx = await requirePermission(orgId, "employees.manage");
  const canManage = ctx.can("employees.manage");
  const [employees, invitations, departments, projects, branchRows] = await Promise.all([
    getEmployees(orgId),
    canManage ? getPendingInvitations(orgId) : Promise.resolve([]),
    getDepartments(orgId),
    getProjects(orgId),
    getBranches(orgId),
  ]);
  const branches = branchRows.map((b) => ({ id: b.id, name: b.name }));

  const people: Person[] = employees
    .filter((e) => e.status === "active" && isRole(e.role_id))
    .map((e) => ({
      id: e.id,
      name: displayName(e.profile),
      avatar: e.profile?.avatar_url ?? null,
      fullName: e.profile?.full_name ?? null,
      email: e.profile?.email ?? null,
      role: e.role_id,
      position: e.position,
      managerId: e.manager_id,
      departmentId: e.department_id,
      directsBranchId: e.directs_branch_id,
      weeklyHours: e.weekly_hours,
      isMe: e.id === ctx.membership.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Los proyectos visibles dependen del rol (RLS): el conteo refleja lo que esta persona puede ver
  const departmentInfo: DepartmentInfo[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    headId: d.head_id,
    branchId: d.branch_id,
    projectCount: projects.filter((p) => p.department_id === d.id).length,
  }));

  return (
    <>
      <PageHeader title="Personas" description={`Quiénes forman ${ctx.organization.name}, en qué departamento están y a quién reportan.`} />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <StatCard index={0} label="Personas activas" value={people.length} icon={Users} />
        <StatCard index={1} label="Departamentos" value={departments.length} icon={Building2} />
        <StatCard
          index={2}
          label="Invitaciones pendientes"
          value={invitations.length}
          icon={Mail}
          hint={canManage ? undefined : "Visible para administradores"}
        />
      </div>

      <div className={canManage ? "mt-6 grid gap-6 lg:grid-cols-[1fr_340px]" : "mt-6"}>
        <TeamView
          orgId={orgId}
          people={people}
          myRole={ctx.role}
          canManage={canManage}
          canManageDepartments={ctx.can("departments.manage")}
          departments={departmentInfo}
          branches={branches}
        />
        {canManage ? (
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader title="Sumar a alguien" description="Invitalo con su departamento y rol desde el primer día" />
            <CardBody>
              <InvitePanel
                orgId={orgId}
                myRole={ctx.role}
                managers={people.map((p) => ({ id: p.id, name: p.name }))}
                departments={departmentInfo.map((d) => ({ id: d.id, name: d.name, hasHead: !!d.headId }))}
                branches={branches}
                pending={invitations.filter((i) => isRole(i.role_id)).map((i) => ({
                  id: i.id,
                  email: i.email,
                  role: i.role_id,
                  position: i.position,
                  departmentName: departments.find((d) => d.id === i.department_id)?.name ?? null,
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
