import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, ListChecks, Target } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProject, getProjectMembers, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { canManageProject } from "@/lib/domain/projects";
import { ArchiveButton } from "./archive-button";
import { MembersPanel } from "./members-panel";
import { TaskBoard, type BoardTask } from "./task-board";
import { NewTaskForm } from "./task-form";

export const metadata: Metadata = { title: "Proyecto" };

export default async function ProjectPage({ params }: PageProps<"/app/[orgId]/projects/[projectId]">) {
  const { orgId, projectId } = await params;
  const ctx = await getOrgContext(orgId);
  // RLS: si el usuario no puede ver el proyecto, no vuelve nada → 404
  const project = await getProject(projectId);
  if (!project || project.org_id !== orgId) notFound();

  const [allTasks, minutes, employees, allMembers, departments, headed] = await Promise.all([
    getTasks(orgId),
    getTaskMinutes(orgId),
    getEmployees(orgId),
    getProjectMembers(orgId),
    getDepartments(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
  ]);
  const tasks = allTasks.filter((t) => t.project_id === project.id);
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
  const manage = canManageProject(
    { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set() },
    project,
  );
  const department = departments.find((d) => d.id === project.department_id);

  const memberIds = new Set(allMembers.filter((m) => m.project_id === project.id).map((m) => m.membership_id));
  const active = employees.filter((e) => e.status === "active");
  const members = active
    .filter((e) => memberIds.has(e.id))
    .map((e) => ({ id: e.id, name: displayName(e.profile), position: e.position, isMe: e.id === ctx.membership.id }));
  // Candidatos: primero las personas del departamento del proyecto
  const candidates = active
    .filter((e) => !memberIds.has(e.id))
    .map((e) => ({ id: e.id, name: displayName(e.profile), sameDepartment: !!project.department_id && e.department_id === project.department_id }))
    .sort((a, b) => Number(b.sameDepartment) - Number(a.sameDepartment) || a.name.localeCompare(b.name, "es"));

  const board: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    assigneeName: t.assigned_to ? (names.get(t.assigned_to) ?? null) : null,
    estimatedHours: t.estimated_hours,
    loggedHours: (minutes.get(t.id) ?? 0) / 60,
    canEdit: manage || t.assigned_to === ctx.membership.id,
    mine: t.assigned_to === ctx.membership.id,
  }));

  const logged = board.reduce((s, t) => s + t.loggedHours, 0);
  const estimated = board.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
  const done = board.filter((t) => t.status === "done").length;
  const budgetPct = project.budgeted_hours ? (logged / project.budgeted_hours) * 100 : 0;

  return (
    <>
      <Link
        href={`/app/${orgId}/projects`}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Proyectos
      </Link>
      <PageHeader
        eyebrow={[department?.name ?? "Sin departamento", project.client_name ?? "Proyecto interno"].join(" · ")}
        title={project.name}
        actions={manage ? <ArchiveButton orgId={orgId} projectId={project.id} status={project.status} /> : null}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          index={0}
          label="Horas imputadas"
          value={logged * 60}
          format="minutes"
          icon={Clock3}
          tone={budgetPct > 100 ? "danger" : budgetPct > 85 ? "warning" : undefined}
          hint={project.budgeted_hours ? `${Math.round(budgetPct)}% de ${project.budgeted_hours}h presupuestadas` : "Sin presupuesto definido"}
        />
        <StatCard index={1} label="Estimado en tareas" value={estimated * 60} format="minutes" icon={Target} hint="Suma de estimaciones" />
        <StatCard index={2} label="Tareas completadas" value={done} icon={ListChecks} hint={`de ${board.length} en total`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          {manage ? (
            <Card>
              <CardBody>
                <NewTaskForm orgId={orgId} projectId={project.id} people={members.map((m) => ({ id: m.id, name: m.name }))} />
              </CardBody>
            </Card>
          ) : null}
          <TaskBoard orgId={orgId} tasks={board} />
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader
            title={`Miembros · ${members.length}`}
            description={manage ? "Solo los miembros ven el proyecto y reciben tareas" : "Personas que participan del proyecto"}
          />
          <CardBody>
            <MembersPanel orgId={orgId} projectId={project.id} members={members} candidates={candidates} canManage={manage} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
