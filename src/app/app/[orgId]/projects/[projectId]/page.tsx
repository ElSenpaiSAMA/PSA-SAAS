import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, ListChecks, Target } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { getEmployees } from "@/lib/data/employees";
import { getProject, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { ArchiveButton } from "./archive-button";
import { TaskBoard, type BoardTask } from "./task-board";
import { NewTaskForm } from "./task-form";

export const metadata: Metadata = { title: "Proyecto" };

export default async function ProjectPage({ params }: PageProps<"/app/[orgId]/projects/[projectId]">) {
  const { orgId, projectId } = await params;
  const ctx = await getOrgContext(orgId);
  const project = await getProject(projectId);
  if (!project || project.org_id !== orgId) notFound();

  const [allTasks, minutes, employees] = await Promise.all([getTasks(orgId), getTaskMinutes(orgId), getEmployees(orgId)]);
  const tasks = allTasks.filter((t) => t.project_id === project.id);
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
  const manageAll = ctx.can("tasks.manage_all");

  const board: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    assigneeName: t.assigned_to ? (names.get(t.assigned_to) ?? null) : null,
    estimatedHours: t.estimated_hours,
    loggedHours: (minutes.get(t.id) ?? 0) / 60,
    canEdit: manageAll || t.assigned_to === ctx.membership.id,
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
        eyebrow={project.client_name ?? "Proyecto interno"}
        title={project.name}
        actions={ctx.can("projects.manage") ? <ArchiveButton orgId={orgId} projectId={project.id} status={project.status} /> : null}
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

      {manageAll ? (
        <Card className="mt-4">
          <CardBody>
            <NewTaskForm
              orgId={orgId}
              projectId={project.id}
              people={employees
                .filter((e) => e.status === "active")
                .map((e) => ({ id: e.id, name: displayName(e.profile) }))}
            />
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-6">
        <TaskBoard orgId={orgId} tasks={board} />
      </div>
    </>
  );
}
