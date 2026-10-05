import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Clock3, Euro, Tag } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { BillingBadge, WorkOrderStatusBadge } from "@/components/app/work-order-badges";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/motion";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProject, getProjectMembers, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getProjectWorkOrders } from "@/lib/data/work-orders";
import { displayName } from "@/lib/domain/hierarchy";
import { formatRange, monthEnd, monthStart, todayISO } from "@/lib/domain/periods";
import { canManageProject } from "@/lib/domain/projects";
import { formatMoney, workOrderAmounts, workOrderCode } from "@/lib/domain/work-orders";
import { CopyNextButton } from "../../work-orders/copy-next-button";
import { NewWorkOrder } from "../../work-orders/new-work-order";
import { ArchiveButton } from "./archive-button";
import { MembersPanel } from "./members-panel";

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
  const manage = canManageProject(
    { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set() },
    project,
  );
  const department = departments.find((d) => d.id === project.department_id);
  const rate = project.hourly_rate === null ? null : Number(project.hourly_rate);

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

  const rows = workOrders.map((wo) => {
    const own = allTasks.filter((t) => t.work_order_id === wo.id);
    const logged = own.reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60;
    const amounts = workOrderAmounts({
      budgetedHours: wo.budgeted_hours === null ? null : Number(wo.budgeted_hours),
      loggedHours: logged,
      hourlyRate: wo.hourly_rate === null ? null : Number(wo.hourly_rate),
    });
    return { wo, logged, amounts, taskCount: own.length };
  });
  const totalLogged = rows.reduce((s, r) => s + r.logged, 0);
  const totalAmount = rows.reduce((s, r) => s + (r.amounts.actualAmount ?? 0), 0);
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          {rows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin órdenes de trabajo"
              description={manage ? "Creá la primera OT para planificar tareas e imputar horas." : "Cuando se cree una OT, la vas a ver acá."}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {rows.map(({ wo, logged, amounts, taskCount }) => (
                <Link
                  key={wo.id}
                  href={`/app/${orgId}/work-orders/${wo.id}`}
                  className="grid gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/40 md:grid-cols-[1.5fr_1fr_1.2fr_0.8fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-mono">{workOrderCode(wo.number)}</span> · {formatRange(wo.period_start, wo.period_end)}
                    </p>
                    <p className="truncate text-[14px] font-medium">{wo.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <WorkOrderStatusBadge status={wo.status} />
                    <BillingBadge billing={wo.billing_status} status={wo.status} />
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground">
                      <span>{taskCount} tareas</span>
                      <span className="tabular">
                        {Math.round(logged * 10) / 10}
                        {wo.budgeted_hours !== null ? ` / ${Number(wo.budgeted_hours)}h` : "h"}
                      </span>
                    </div>
                    <ProgressBar
                      value={wo.budgeted_hours ? logged : 0}
                      max={Number(wo.budgeted_hours ?? 1)}
                      tone={(amounts.consumption ?? 0) > 100 ? "danger" : (amounts.consumption ?? 0) > 85 ? "warning" : "accent"}
                    />
                  </div>
                  <p className="text-right text-[14px] font-semibold tabular">{formatMoney(amounts.actualAmount)}</p>
                  <div className="flex justify-end">{manage ? <CopyNextButton orgId={orgId} workOrderId={wo.id} /> : null}</div>
                </Link>
              ))}
            </div>
          )}
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
