import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Euro, Info, ListChecks, Tag } from "lucide-react";
import { NewTaskForm } from "@/components/app/new-task-form";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { TaskBoard, type BoardTask } from "@/components/app/task-board";
import { BillingBadge, WorkOrderStatusBadge } from "@/components/app/work-order-badges";
import { Card, CardBody } from "@/components/ui/card";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProject, getProjectMembers, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getWorkOrder } from "@/lib/data/work-orders";
import { displayName } from "@/lib/domain/hierarchy";
import { formatMonth, formatRange, nextPeriod, toMonthParam } from "@/lib/domain/periods";
import { canManageProject } from "@/lib/domain/projects";
import { acceptsTimeEntries, formatMoney, titleForPeriod, workOrderAmounts, workOrderCode } from "@/lib/domain/work-orders";
import { DuplicateWorkOrder, WorkOrderControls } from "./controls";

export const metadata: Metadata = { title: "Orden de trabajo" };

export default async function WorkOrderPage({ params }: PageProps<"/app/[orgId]/work-orders/[workOrderId]">) {
  const { orgId, workOrderId } = await params;
  const ctx = await getOrgContext(orgId);
  // RLS: sin acceso al proyecto, la OT no vuelve → 404
  const wo = await getWorkOrder(workOrderId);
  if (!wo || wo.org_id !== orgId) notFound();

  const [project, allTasks, minutes, employees, allMembers, departments, headed] = await Promise.all([
    getProject(wo.project_id),
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
        eyebrow={`${workOrderCode(wo.number)} · ${project.name}${department ? ` · ${department.name}` : ""}`}
        title={wo.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {formatRange(wo.period_start, wo.period_end)}
            <WorkOrderStatusBadge status={wo.status} />
            <BillingBadge billing={wo.billing_status} status={wo.status} />
          </span>
        }
      />

      <div className="-mt-4 mb-6">
        <WorkOrderControls
          orgId={orgId}
          workOrderId={wo.id}
          status={wo.status}
          billing={wo.billing_status}
          canManage={manage}
          canBill={ctx.can("billing.manage")}
        />
      </div>

      {!acceptsTimeEntries(wo.status) ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
          <Info className="size-4 shrink-0" />
          {wo.status === "draft"
            ? "En borrador: se pueden planificar tareas, pero las horas se imputan cuando la OT esté aprobada."
            : locked
              ? "OT facturada: queda bloqueada para cambios."
              : "OT cerrada: no admite más horas. Reabrila si hace falta imputar algo."}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Horas imputadas"
          value={logged * 60}
          format="minutes"
          icon={Clock3}
          tone={(amounts.consumption ?? 0) > 100 ? "danger" : (amounts.consumption ?? 0) > 85 ? "warning" : undefined}
          hint={wo.budgeted_hours !== null ? `${amounts.consumption}% de ${Number(wo.budgeted_hours)}h` : "Sin presupuesto"}
        />
        <StatCard index={1} label="Importe real" value={amounts.actualAmount ?? 0} format="currency" icon={Euro} hint={`Presupuestado: ${formatMoney(amounts.budgetAmount)}`} />
        <StatCard index={2} label="Tarifa" value={Number(wo.hourly_rate ?? 0)} format="currency" icon={Tag} hint={wo.hourly_rate === null ? "Sin tarifa definida" : "por hora"} />
        <StatCard index={3} label="Tareas completadas" value={board.filter((t) => t.status === "done").length} icon={ListChecks} hint={`de ${board.length}`} />
      </div>

      {manage && !locked ? (
        <Card className="mt-4">
          <CardBody className="grid gap-4">
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
            <DuplicateWorkOrder
              orgId={orgId}
              workOrderId={wo.id}
              defaultTitle={titleForPeriod(wo.title, wo.period_start, next.start)}
              defaultStart={next.start}
              defaultEnd={next.end}
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
