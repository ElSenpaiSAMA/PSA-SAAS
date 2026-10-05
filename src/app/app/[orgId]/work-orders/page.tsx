import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Clock3, Euro, Receipt } from "lucide-react";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { BillingBadge, WorkOrderStatusBadge } from "@/components/app/work-order-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/motion";
import { getHeadedDepartmentId } from "@/lib/data/departments";
import { getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getWorkOrdersInRange } from "@/lib/data/work-orders";
import { formatRange, monthEnd, monthStart, parseMonthParam, todayISO } from "@/lib/domain/periods";
import { canManageProject } from "@/lib/domain/projects";
import { formatMoney, workOrderAmounts, workOrderCode } from "@/lib/domain/work-orders";
import { CopyNextButton } from "./copy-next-button";
import { NewWorkOrder } from "./new-work-order";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

export default async function WorkOrdersPage({ params, searchParams }: PageProps<"/app/[orgId]/work-orders">) {
  const { orgId } = await params;
  const { month: monthParam } = await searchParams;
  const month = parseMonthParam(monthParam) ?? monthStart(todayISO());
  const from = month;
  const to = monthEnd(month);

  const ctx = await getOrgContext(orgId);
  const [workOrders, projects, tasks, minutes, headed] = await Promise.all([
    getWorkOrdersInRange(orgId, from, to),
    getProjects(orgId),
    getTasks(orgId),
    getTaskMinutes(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
  ]);

  const access = { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set<string>() };
  const manageable = projects.filter((p) => p.status === "active" && canManageProject(access, p));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const rows = workOrders.map((wo) => {
    const own = tasks.filter((t) => t.work_order_id === wo.id);
    const logged = own.reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60;
    const amounts = workOrderAmounts({
      budgetedHours: wo.budgeted_hours === null ? null : Number(wo.budgeted_hours),
      loggedHours: logged,
      hourlyRate: wo.hourly_rate === null ? null : Number(wo.hourly_rate),
    });
    const project = projectById.get(wo.project_id);
    return { wo, logged, amounts, project, taskCount: own.length, done: own.filter((t) => t.status === "done").length };
  });

  const budgeted = rows.reduce((s, r) => s + Number(r.wo.budgeted_hours ?? 0), 0);
  const logged = rows.reduce((s, r) => s + r.logged, 0);
  const pendingInvoice = rows
    .filter((r) => r.wo.status === "closed" && r.wo.billing_status === "unbilled")
    .reduce((s, r) => s + (r.amounts.actualAmount ?? 0), 0);
  const invoiced = rows.filter((r) => r.wo.billing_status === "invoiced").reduce((s, r) => s + (r.amounts.actualAmount ?? 0), 0);

  const groups = [...new Set(rows.map((r) => r.wo.project_id))].map((projectId) => ({
    project: projectById.get(projectId),
    rows: rows.filter((r) => r.wo.project_id === projectId),
  }));

  return (
    <>
      <PageHeader
        title="Órdenes de trabajo"
        description="Cada OT agrupa el trabajo de un proyecto en un período, con su presupuesto de horas, tarifa y facturación."
        actions={<MonthNav month={month} basePath={`/app/${orgId}/work-orders`} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="OT del período" value={rows.length} icon={ClipboardList} />
        <StatCard
          index={1}
          label="Horas imputadas"
          value={logged * 60}
          format="minutes"
          icon={Clock3}
          hint={budgeted ? `de ${Math.round(budgeted)}h presupuestadas` : undefined}
        />
        <StatCard index={2} label="Pendiente de facturar" value={pendingInvoice} format="currency" icon={Receipt} hint="OT cerradas sin facturar" tone={pendingInvoice ? "warning" : undefined} />
        <StatCard index={3} label="Facturado" value={invoiced} format="currency" icon={Euro} hint="En este período" />
      </div>

      {manageable.length > 0 ? (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <NewWorkOrder
            orgId={orgId}
            projects={manageable.map((p) => ({ id: p.id, name: p.name, hourlyRate: p.hourly_rate === null ? null : Number(p.hourly_rate) }))}
            periodStart={from}
            periodEnd={to}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-8">
        {groups.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No hay órdenes de trabajo en este período"
            description={manageable.length ? "Creá una, o copiá la de un mes anterior desde su detalle." : "Cuando haya OT de tus proyectos, las vas a ver acá."}
          />
        ) : (
          groups.map(({ project, rows: projectRows }) => (
            <section key={project?.id ?? "?"}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <Link href={`/app/${orgId}/projects/${project?.id}`} className="text-[14px] font-semibold tracking-tight hover:underline">
                  {project?.name ?? "Proyecto"}
                </Link>
                {project?.client_name ? <span className="text-[12.5px] text-muted-foreground">{project.client_name}</span> : null}
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {projectRows.map(({ wo, logged: hours, amounts, taskCount, done }) => (
                  <Link
                    key={wo.id}
                    href={`/app/${orgId}/work-orders/${wo.id}`}
                    className="group grid gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/40 md:grid-cols-[1.6fr_1fr_1.2fr_0.8fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span className="font-mono">{workOrderCode(wo.number)}</span>
                        <span>·</span>
                        <span>{formatRange(wo.period_start, wo.period_end)}</span>
                      </p>
                      <p className="truncate text-[14px] font-medium">{wo.title}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <WorkOrderStatusBadge status={wo.status} />
                      <BillingBadge billing={wo.billing_status} status={wo.status} />
                    </div>
                    <div>
                      <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground">
                        <span>
                          {done}/{taskCount} tareas
                        </span>
                        <span className="tabular">
                          {Math.round(hours * 10) / 10}
                          {wo.budgeted_hours !== null ? ` / ${Number(wo.budgeted_hours)}h` : "h"}
                        </span>
                      </div>
                      <ProgressBar
                        value={wo.budgeted_hours ? hours : 0}
                        max={Number(wo.budgeted_hours ?? 1)}
                        tone={(amounts.consumption ?? 0) > 100 ? "danger" : (amounts.consumption ?? 0) > 85 ? "warning" : "accent"}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-semibold tabular">{formatMoney(amounts.actualAmount)}</p>
                      <p className="text-[11.5px] text-muted-foreground tabular">de {formatMoney(amounts.budgetAmount)}</p>
                    </div>
                    <div className="flex justify-end">
                      {project && canManageProject(access, project) ? <CopyNextButton orgId={orgId} workOrderId={wo.id} /> : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
