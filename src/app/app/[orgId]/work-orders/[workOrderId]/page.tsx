import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Euro, ListChecks, SquareCheckBig } from "lucide-react";
import { NewTaskForm } from "@/components/app/new-task-form";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { TaskBoard, type BoardTask } from "@/components/app/task-board";
import { EmptyState } from "@/components/ui/empty-state";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProject, getProjectMembers, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getProjectWorkOrders, getWorkOrder } from "@/lib/data/work-orders";
import { displayName } from "@/lib/domain/hierarchy";
import { formatMonth, formatRange, nextPeriod, toMonthParam } from "@/lib/domain/periods";
import { canManageProject } from "@/lib/domain/projects";
import { findContinuation, formatMoney, titleForPeriod, workOrderAmounts, workOrderCode } from "@/lib/domain/work-orders";
import { Collapsible, NextStepPanel, RepeatWorkOrder } from "./controls";

export const metadata: Metadata = { title: "Orden de trabajo" };

export default async function WorkOrderPage({ params }: PageProps<"/app/[orgId]/work-orders/[workOrderId]">) {
  const { orgId, workOrderId } = await params;
  const ctx = await getOrgContext(orgId);
  // RLS: sin acceso al proyecto, la OT no vuelve → 404
  const wo = await getWorkOrder(workOrderId);
  if (!wo || wo.org_id !== orgId) notFound();

  const [project, siblings, allTasks, minutes, employees, allMembers, departments, headed] = await Promise.all([
    getProject(wo.project_id),
    getProjectWorkOrders(wo.project_id),
    getTasks(orgId),
    getTaskMinutes(orgId),
    getEmployees(orgId),
    getProjectMembers(orgId),
    getDepartments(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
  ]);
  if (!project) notFound();

  const manage = canManageProject(
    { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set() },
    project,
  );
  const locked = wo.billing_status === "invoiced";
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
  const tasks = allTasks.filter((t) => t.work_order_id === wo.id);
  const logged = tasks.reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60;
  const amounts = workOrderAmounts({
    budgetedHours: wo.budgeted_hours === null ? null : Number(wo.budgeted_hours),
    loggedHours: logged,
    hourlyRate: wo.hourly_rate === null ? null : Number(wo.hourly_rate),
  });
  const department = departments.find((d) => d.id === project.department_id);
  const memberIds = new Set(allMembers.filter((m) => m.project_id === project.id).map((m) => m.membership_id));
  const next = nextPeriod(wo.period_start, wo.period_end);
  const continuation = findContinuation(wo, siblings);

  const board: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    assigneeName: t.assigned_to ? (names.get(t.assigned_to) ?? null) : null,
    estimatedHours: t.estimated_hours === null ? null : Number(t.estimated_hours),
    loggedHours: (minutes.get(t.id) ?? 0) / 60,
    startDate: t.start_date,
    dueDate: t.due_date,
    canEdit: !locked && (manage || t.assigned_to === ctx.membership.id),
    canDuplicate: !locked && manage,
    canManage: !locked && manage,
    assignedTo: t.assigned_to,
    mine: t.assigned_to === ctx.membership.id,
  }));

  return (
    <>
      <Link
        href={`/app/${orgId}/work-orders?month=${toMonthParam(wo.period_start)}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Órdenes de {formatMonth(wo.period_start)}
      </Link>

      <PageHeader
        eyebrow={[workOrderCode(wo.number), project.name, project.client_name, department?.name].filter(Boolean).join(" · ")}
        title={wo.title}
        description={formatRange(wo.period_start, wo.period_end)}
      />

      <NextStepPanel
        orgId={orgId}
        workOrderId={wo.id}
        status={wo.status}
        billing={wo.billing_status}
        canManage={manage}
        canBill={ctx.can("billing.manage")}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          index={0}
          label="Horas imputadas"
          value={logged * 60}
          format="minutes"
          icon={Clock3}
          tone={(amounts.consumption ?? 0) > 100 ? "danger" : (amounts.consumption ?? 0) > 85 ? "warning" : undefined}
          hint={
            wo.budgeted_hours !== null
              ? `${amounts.consumption}% de ${Number(wo.budgeted_hours)} h presupuestadas`
              : "Sin presupuesto de horas"
          }
        />
        <StatCard
          index={1}
          label="Importe"
          value={amounts.actualAmount ?? 0}
          format="currency"
          icon={Euro}
          hint={
            wo.hourly_rate === null
              ? "Sin tarifa: no se factura"
              : `${formatMoney(Number(wo.hourly_rate))}/h · presupuesto ${formatMoney(amounts.budgetAmount)}`
          }
        />
        <StatCard
          index={2}
          label="Tareas completadas"
          value={board.filter((t) => t.status === "done").length}
          icon={ListChecks}
          hint={`de ${board.length}`}
        />
      </div>

      {manage ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2 lg:items-start">
          {!locked ? (
          <Collapsible title="Agregar tarea" icon="plus" defaultOpen={tasks.length === 0}>
            <NewTaskForm
              orgId={orgId}
              projectId={project.id}
              workOrderId={wo.id}
              periodStart={wo.period_start}
              periodEnd={wo.period_end}
              people={employees
                .filter((e) => e.status === "active" && memberIds.has(e.id))
                .map((e) => ({ id: e.id, name: displayName(e.profile) }))}
            />
          </Collapsible>
          ) : null}
          <Collapsible title="Repetir esta OT en otro período" icon="repeat">
            <RepeatWorkOrder
              orgId={orgId}
              workOrderId={wo.id}
              nextLabel={formatMonth(next.start)}
              continuationHref={continuation ? `/app/${orgId}/work-orders/${continuation.id}` : undefined}
              defaultTitle={titleForPeriod(wo.title, wo.period_start, next.start)}
              defaultStart={next.start}
              defaultEnd={next.end}
            />
          </Collapsible>
        </div>
      ) : null}

      <div className="mt-6">
        {board.length > 0 ? (
          <TaskBoard
            orgId={orgId}
            tasks={board}
            people={employees.filter((e) => e.status === "active" && memberIds.has(e.id)).map((e) => ({ id: e.id, name: displayName(e.profile) }))}
          />
        ) : (
          <EmptyState
            icon={SquareCheckBig}
            title="Esta OT todavía no tiene tareas"
            description={manage && !locked ? "Agregá las tareas del período: el equipo imputa sus horas sobre ellas." : "Cuando se planifiquen tareas, las vas a ver acá."}
          />
        )}
      </div>
    </>
  );
}
