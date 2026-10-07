import type { Metadata } from "next";
import { AlertTriangle, ClipboardList, Clock3, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProjectMembers, getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getAllWorkOrders } from "@/lib/data/work-orders";
import { displayName } from "@/lib/domain/hierarchy";
import { creatableDepartments } from "@/lib/domain/projects";
import { NewProject } from "./project-form";
import { ProjectsTable, type ProjectRow } from "./projects-table";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage({ params }: PageProps<"/app/[orgId]/projects">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  // RLS ya devuelve solo los proyectos visibles para este usuario
  const [projects, tasks, minutes, departments, members, employees, headed, workOrders] = await Promise.all([
    getProjects(orgId),
    getTasks(orgId),
    getTaskMinutes(orgId),
    getDepartments(orgId),
    getProjectMembers(orgId),
    getEmployees(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
    getAllWorkOrders(orgId),
  ]);

  const managesAll = ctx.can("projects.manage");
  const canCreate = creatableDepartments(
    { managesAllProjects: managesAll, headOfDepartmentId: headed, memberOf: new Set() },
    departments,
  );
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));

  const description = managesAll
    ? "Todos los proyectos de la empresa, con sus horas presupuestadas contra las reales."
    : headed
      ? "Los proyectos de tu departamento y aquellos en los que participás."
      : "Los proyectos en los que participás.";

  const rows: ProjectRow[] = projects.map((p) => {
    const own = tasks.filter((t) => t.project_id === p.id);
    return {
      id: p.id,
      name: p.name,
      client: p.client_name,
      department: (p.department_id && departmentName.get(p.department_id)) || "Sin área",
      status: p.status,
      budgetedHours: p.budgeted_hours,
      loggedHours: own.reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60,
      tasksDone: own.filter((t) => t.status === "done").length,
      tasksTotal: own.length,
      mine: own.filter((t) => t.assigned_to === ctx.membership.id && t.status !== "done").length,
      openWorkOrders: workOrders.filter((w) => w.project_id === p.id && w.status !== "closed").length,
      team: members.filter((m) => m.project_id === p.id).map((m) => names.get(m.membership_id) ?? "?"),
    };
  });

  const active = rows.filter((r) => r.status === "active");
  const logged = active.reduce((s, r) => s + r.loggedHours, 0);
  const budget = active.reduce((s, r) => s + (r.budgetedHours ?? 0), 0);
  const atRisk = active.filter((r) => r.budgetedHours && r.loggedHours / r.budgetedHours > 0.85).length;

  return (
    <>
      <PageHeader
        title="Proyectos"
        description={description}
      />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Proyectos activos" value={active.length} icon={FolderKanban} hint={`${rows.length - active.length} archivados`} index={0} />
        <StatCard label="Horas imputadas" value={Math.round(logged)} icon={Clock3} hint={budget ? `de ${budget} h presupuestadas` : "sin presupuesto"} index={1} />
        <StatCard
          label="En riesgo o excedidos"
          value={atRisk}
          icon={AlertTriangle}
          tone={atRisk ? "warning" : undefined}
          hint="Más del 85 % del presupuesto consumido"
          index={2}
        />
        <StatCard label="OT abiertas" value={active.reduce((s, r) => s + r.openWorkOrders, 0)} icon={ClipboardList} hint="Sin cerrar" index={3} />
      </div>

      {canCreate.length > 0 || managesAll ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <NewProject orgId={orgId} departments={canCreate.map((d) => ({ id: d.id, name: d.name }))} allowNoDepartment={managesAll} />
        </div>
      ) : null}

      <div className="mt-4">
        <ProjectsTable orgId={orgId} rows={rows} />
      </div>
    </>
  );
}
