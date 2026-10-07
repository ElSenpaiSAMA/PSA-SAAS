import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Clock3, Euro, Tag } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { canManageProjectDb, getProject, getProjectMembers, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getProjectWorkOrders } from "@/lib/data/work-orders";
import { displayName } from "@/lib/domain/hierarchy";
import { projectTeam } from "@/lib/domain/projects";
import { monthEnd, monthStart, todayISO } from "@/lib/domain/periods";
import { findContinuation, workOrderAmounts } from "@/lib/domain/work-orders";
import { NewWorkOrder } from "../../work-orders/new-work-order";
import { toWorkOrderRow, WorkOrderList } from "../../work-orders/work-order-row";
import { ArchiveButton } from "./archive-button";
import { MembersPanel } from "./members-panel";
import { RecurringToggle } from "./recurring-toggle";

export const metadata: Metadata = { title: "Proyecto" };

export default async function ProjectPage({ params }: PageProps<"/app/[orgId]/projects/[projectId]">) {
  const { orgId, projectId } = await params;
  const ctx = await getOrgContext(orgId);
  // RLS: si el usuario no puede ver el proyecto, no vuelve nada → 404
  const project = await getProject(projectId);
  if (!project || project.org_id !== orgId) notFound();

  const [workOrders, allTasks, minutes, employees, allMembers, departments, headed] = await Promise.all([
    getProjectWorkOrders(project.id),
    getTasks(orgId),
    getTaskMinutes(orgId),
    getEmployees(orgId),
    getProjectMembers(orgId),
    getDepartments(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
  ]);
  const manage = await canManageProjectDb(project.id);
  const projectMembers = allMembers.filter((m) => m.project_id === project.id);
  const myProjectRole = projectMembers.find((m) => m.membership_id === ctx.membership.id)?.role;
  // Quien solo es responsable del proyecto invita, pero no nombra otros responsables
  const canAppointLead =
    ctx.can("projects.manage") || headed === project.department_id || (manage && myProjectRole !== "lead");
  const department = departments.find((d) => d.id === project.department_id);
  const rate = project.hourly_rate === null ? null : Number(project.hourly_rate);

  const { members, candidates } = projectTeam(
    employees
      .filter((e) => e.status === "active")
      .map((e) => ({ id: e.id, name: displayName(e.profile), avatar: e.profile?.avatar_url ?? null, position: e.position, departmentId: e.department_id })),
    projectMembers,
    project,
    ctx.membership.id,
  );

  const rows = workOrders.map((wo) =>
    toWorkOrderRow(wo, allTasks, minutes, {
      canCopy: manage && project.status === "active",
      continuationId: findContinuation(wo, workOrders)?.id,
    }),
  );
  const totalLogged = rows.reduce((s, r) => s + r.loggedHours, 0);
  const totalAmount = rows.reduce(
    (s, r) => s + (workOrderAmounts({ budgetedHours: r.budgetedHours, loggedHours: r.loggedHours, hourlyRate: r.hourlyRate }).actualAmount ?? 0),
    0,
  );
  const thisMonth = monthStart(todayISO());

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

      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Órdenes de trabajo" value={rows.length} icon={ClipboardList} />
        <StatCard
          index={1}
          label="Horas imputadas"
          value={totalLogged * 60}
          format="minutes"
          icon={Clock3}
          hint={project.budgeted_hours ? `de ${Number(project.budgeted_hours)}h del proyecto` : "Total histórico"}
        />
        <StatCard index={2} label="Importe acumulado" value={totalAmount} format="currency" icon={Euro} hint="Horas × tarifa de cada OT" />
        <StatCard index={3} label="Tarifa del proyecto" value={rate ?? 0} format="currency" icon={Tag} hint={rate === null ? "Proyecto interno" : "por hora"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight">Órdenes de trabajo</h2>
            {manage && project.status === "active" ? (
              <NewWorkOrder
                orgId={orgId}
                projects={[{ id: project.id, name: project.name, hourlyRate: rate }]}
                defaultProjectId={project.id}
                periodStart={thisMonth}
                periodEnd={monthEnd(thisMonth)}
              />
            ) : null}
          </div>

          <RecurringToggle orgId={orgId} projectId={project.id} enabled={project.recurring_work_orders} canManage={manage} />

          {rows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin órdenes de trabajo"
              description={manage ? "Creá la primera OT para planificar tareas e imputar horas." : "Cuando se cree una OT, la vas a ver acá."}
            />
          ) : (
            <WorkOrderList orgId={orgId} rows={rows} />
          )}
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader
            title={`Equipo · ${members.length}`}
            description={manage ? "Invitá a quien necesites: entra al instante y lo ve todo el equipo" : "Quiénes participan del proyecto y con qué rol"}
          />
          <CardBody>
            <MembersPanel
              orgId={orgId}
              projectId={project.id}
              members={members}
              candidates={candidates}
              canManage={manage}
              canAppointLead={canAppointLead}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
