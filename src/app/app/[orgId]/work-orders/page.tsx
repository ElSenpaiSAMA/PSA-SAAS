import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Clock3, Euro, Receipt } from "lucide-react";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getHeadedDepartmentId } from "@/lib/data/departments";
import { getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getWorkOrdersInRange } from "@/lib/data/work-orders";
import { addMonths, formatMonth, monthEnd, monthStart, parseMonthParam, todayISO, toMonthParam } from "@/lib/domain/periods";
import { canManageProject } from "@/lib/domain/projects";
import { FILTERS, findContinuation, matchesFilter, missingContinuations, workOrderAmounts, type WorkOrderFilter } from "@/lib/domain/work-orders";
import { cn } from "@/lib/utils";
import { CopyPreviousBanner } from "./copy-previous-banner";
import { HowItWorks } from "./how-it-works";
import { NewWorkOrder } from "./new-work-order";
import { toWorkOrderRow, WorkOrderList } from "./work-order-row";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

const isFilter = (v: unknown): v is WorkOrderFilter => FILTERS.some((f) => f.key === v);

export default async function WorkOrdersPage({ params, searchParams }: PageProps<"/app/[orgId]/work-orders">) {
  const { orgId } = await params;
  const { month: monthParam, status: statusParam } = await searchParams;
  const month = parseMonthParam(monthParam) ?? monthStart(todayISO());
  const filter: WorkOrderFilter = isFilter(statusParam) ? statusParam : "all";
  const from = month;
  const to = monthEnd(month);
  const previous = addMonths(month, -1);

  const ctx = await getOrgContext(orgId);
  const [workOrders, previousOrders, nextOrders, projects, tasks, minutes, headed] = await Promise.all([
    getWorkOrdersInRange(orgId, from, to),
    getWorkOrdersInRange(orgId, previous, monthEnd(previous)),
    getWorkOrdersInRange(orgId, addMonths(month, 1), monthEnd(addMonths(month, 1))),
    getProjects(orgId),
    getTasks(orgId),
    getTaskMinutes(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
  ]);

  const access = { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set<string>() };
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const canManage = (projectId: string) => {
    const p = projectById.get(projectId);
    return !!p && p.status === "active" && canManageProject(access, p);
  };
  const manageable = projects.filter((p) => canManage(p.id));

  const rows = workOrders
    .map((wo) => {
      const project = projectById.get(wo.project_id);
      return toWorkOrderRow(wo, tasks, minutes, {
        projectName: project?.name,
        clientName: project?.client_name,
        canCopy: canManage(wo.project_id),
        continuationId: findContinuation(wo, nextOrders)?.id,
      });
    })
    .sort((a, b) => (a.projectName ?? "").localeCompare(b.projectName ?? "", "es") || a.number - b.number);
  const visible = rows.filter((r) => matchesFilter(filter, r.status, r.billing));

  const amountOf = (r: (typeof rows)[number]) =>
    workOrderAmounts({ budgetedHours: r.budgetedHours, loggedHours: r.loggedHours, hourlyRate: r.hourlyRate }).actualAmount ?? 0;
  const budgeted = rows.reduce((s, r) => s + (r.budgetedHours ?? 0), 0);
  const logged = rows.reduce((s, r) => s + r.loggedHours, 0);
  const pendingInvoice = rows.filter((r) => matchesFilter("to_invoice", r.status, r.billing)).reduce((s, r) => s + amountOf(r), 0);
  const invoiced = rows.filter((r) => r.billing === "invoiced").reduce((s, r) => s + amountOf(r), 0);

  // Recurrencia: OT del mes anterior (que puedo gestionar) sin su OT en este mes
  const uncopied = missingContinuations(
    previousOrders.filter((w) => w.period_start >= previous && canManage(w.project_id)),
    workOrders,
    month,
  );

  const basePath = `/app/work-orders`;
  const hrefFor = (f: WorkOrderFilter) => {
    const q = new URLSearchParams({ month: toMonthParam(month) });
    if (f !== "all") q.set("status", f);
    return `${basePath}?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Órdenes de trabajo"
        description="El trabajo de cada proyecto, mes a mes: tareas, horas presupuestadas e imputadas, y facturación."
        actions={<MonthNav month={month} basePath={basePath} />}
      />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="OT del mes" value={rows.length} icon={ClipboardList} />
        <StatCard
          index={1}
          label="Horas imputadas"
          value={logged * 60}
          format="minutes"
          icon={Clock3}
          hint={budgeted ? `de ${Math.round(budgeted)} h presupuestadas` : undefined}
        />
        <StatCard
          index={2}
          label="Por facturar"
          value={pendingInvoice}
          format="currency"
          icon={Receipt}
          hint="OT cerradas sin facturar"
          tone={pendingInvoice ? "warning" : undefined}
        />
        <StatCard index={3} label="Facturado" value={invoiced} format="currency" icon={Euro} hint="En este mes" />
      </div>

      <div className="mt-6 grid gap-4">
        <HowItWorks />

        {uncopied.length > 0 ? (
          <CopyPreviousBanner
            orgId={orgId}
            month={toMonthParam(month)}
            monthLabel={formatMonth(month)}
            previousLabel={formatMonth(previous)}
            titles={uncopied.map((w) => w.title)}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = rows.filter((r) => matchesFilter(f.key, r.status, r.billing)).length;
              const active = f.key === filter;
              return (
                <Link
                  key={f.key}
                  href={hrefFor(f.key)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className={cn("tabular", active ? "opacity-70" : "opacity-60")}>{count}</span>
                </Link>
              );
            })}
          </nav>
          {manageable.length > 0 ? (
            <NewWorkOrder
              orgId={orgId}
              projects={manageable.map((p) => ({ id: p.id, name: p.name, hourlyRate: p.hourly_rate === null ? null : Number(p.hourly_rate) }))}
              periodStart={from}
              periodEnd={to}
            />
          ) : null}
        </div>

        {visible.length > 0 ? (
          <WorkOrderList orgId={orgId} rows={visible} />
        ) : rows.length > 0 ? (
          <EmptyState icon={ClipboardList} title="Ninguna OT en este estado" description="Probá con otro filtro o cambiá de mes." />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title={`No hay órdenes de trabajo en ${formatMonth(month)}`}
            description={
              manageable.length
                ? "Creá una nueva, o copiá las del mes anterior si el trabajo se repite."
                : "Cuando haya OT de tus proyectos, las vas a ver acá."
            }
          />
        )}
      </div>
    </>
  );
}
