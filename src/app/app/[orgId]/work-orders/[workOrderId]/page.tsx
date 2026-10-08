import type { Metadata } from "next";
import Link from "next/link";
import { resolveSlug } from "@/lib/data/slugs";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Euro, ListChecks, SquareCheckBig } from "lucide-react";
import { NewTaskForm } from "@/components/app/new-task-form";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { TaskBoard, type BoardTask } from "@/components/app/task-board";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { canManageProjectDb, getProject, getProjectMembers, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getProjectWorkOrders, getWorkOrder } from "@/lib/data/work-orders";
import { displayName } from "@/lib/domain/hierarchy";
import { projectTeam } from "@/lib/domain/projects";
import { formatMonth, formatRange, nextPeriod, toMonthParam } from "@/lib/domain/periods";
import { findContinuation, formatMoney, titleForPeriod, workOrderAmounts, workOrderCode } from "@/lib/domain/work-orders";
import { MembersPanel } from "../../projects/[projectId]/members-panel";
import { NextStepPanel, RepeatWorkOrder, TasksPanel } from "./controls";
import { urlKey } from "@/lib/domain/slug";

export const metadata: Metadata = { title: "Orden de trabajo" };

export default async function WorkOrderPage({ params }: PageProps<"/app/[orgId]/work-orders/[workOrderId]">) {
  const { orgId, workOrderId: param } = await params;
  const ctx = await getOrgContext(orgId);
  const workOrderId = await resolveSlug("work_orders", orgId, param);
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

  const manage = await canManageProjectDb(project.id);
  // Equipo de la OT = equipo del proyecto: invitar acá suma a la persona al proyecto
  const projectMembers = allMembers.filter((m) => m.project_id === project.id);
  const myProjectRole = projectMembers.find((m) => m.membership_id === ctx.membership.id)?.role;
  const canAppointLead = ctx.can("projects.manage") || headed === project.department_id || (manage && myProjectRole !== "lead");
  const team = projectTeam(
    employees
      .filter((e) => e.status === "active")
      .map((e) => ({ id: e.id, name: displayName(e.profile), avatar: e.profile?.avatar_url ?? null, position: e.position, departmentId: e.department_id })),
    projectMembers,
    project,
    ctx.membership.id,
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
        href={`/app/work-orders?month=${toMonthParam(wo.period_start)}`}
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

      <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
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

      <div className="mt-4">
        <TasksPanel
          count={board.length}
          defaultOpen={manage && !locked && tasks.length === 0 ? "add" : undefined}
          addForm={
            manage && !locked ? (
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
            ) : undefined
          }
          repeatForm={
            manage ? (
              <RepeatWorkOrder
                orgId={orgId}
                workOrderId={wo.id}
                nextLabel={formatMonth(next.start)}
                continuationHref={continuation ? `/app/work-orders/${urlKey(continuation)}` : undefined}
                defaultTitle={titleForPeriod(wo.title, wo.period_start, next.start)}
                defaultStart={next.start}
                defaultEnd={next.end}
              />
            ) : undefined
          }
        >
          {board.length > 0 ? (
            <TaskBoard
              orgId={orgId}
              tasks={board}
              people={employees
                .filter((e) => e.status === "active" && memberIds.has(e.id))
                .map((e) => ({ id: e.id, name: displayName(e.profile) }))}
            />
          ) : (
            <EmptyState
              icon={SquareCheckBig}
              title="Esta OT todavía no tiene tareas"
              description={
                manage && !locked
                  ? "Agregá las tareas del período: el equipo imputa sus horas sobre ellas."
                  : "Cuando se planifiquen tareas, las vas a ver acá."
              }
            />
          )}
        </TasksPanel>

        <Card>
          <CardHeader
            title={`Equipo · ${team.members.length}`}
            description={
              manage
                ? "Invitá a quien necesites para esta OT: entra al proyecto al instante y lo ve todo el equipo"
                : "Quiénes trabajan en esta OT y con qué rol"
            }
          />
          <CardBody>
            <MembersPanel
              orgId={orgId}
              projectId={project.id}
              members={team.members}
              candidates={team.candidates}
              canManage={manage && !locked}
              canAppointLead={canAppointLead}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
