import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck2, Clock3, Download, Euro, Gauge, Receipt, Timer, UserX } from "lucide-react";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/motion";
import { availableReports, getAbsencesReport, getBillingReport, getHoursReport, REPORT_LABEL, type ReportType } from "@/lib/data/reports";
import { formatMonth, monthStart, parseMonthParam, todayISO, toMonthParam } from "@/lib/domain/periods";
import { ABSENCE_LABEL } from "@/lib/domain/vacations";
import { formatMoney } from "@/lib/domain/work-orders";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Informes" };

const fmtH = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;
const TH = "px-3 py-2.5 text-left font-medium whitespace-nowrap";
const TD = "px-3 py-2.5 whitespace-nowrap";

export default async function ReportsPage({ params, searchParams }: PageProps<"/app/[orgId]/reports">) {
  const { orgId } = await params;
  const { tab: tabParam, month: monthParam } = await searchParams;
  const available = await availableReports(orgId);
  if (available.length === 0) notFound();
  const tab: ReportType = available.includes(tabParam as ReportType) ? (tabParam as ReportType) : available[0];
  const month = parseMonthParam(monthParam) ?? monthStart(todayISO());
  const base = `/app/${orgId}/reports`;
  const exportHref = `${base}/export?type=${tab}&month=${toMonthParam(month)}`;

  return (
    <>
      <PageHeader
        title="Informes"
        description={`${REPORT_LABEL[tab]} de ${formatMonth(month)}. Lo que ves es lo que se exporta.`}
        actions={<MonthNav month={month} basePath={base} query={{ tab }} />}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {available.length > 1 ? (
          <nav aria-label="Informes" className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
            {available.map((t) => (
              <Link
                key={t}
                href={`${base}?tab=${t}&month=${toMonthParam(month)}`}
                aria-current={tab === t ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-lg px-3.5 text-[13px] transition-colors",
                  tab === t ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {REPORT_LABEL[t]}
              </Link>
            ))}
          </nav>
        ) : (
          <span />
        )}
        <a href={exportHref} download className={buttonClasses("secondary", "md")}>
          <Download className="size-4" /> Exportar a Excel (CSV)
        </a>
      </div>

      {tab === "facturacion" ? <Billing orgId={orgId} month={month} /> : null}
      {tab === "horas" ? <Hours orgId={orgId} month={month} /> : null}
      {tab === "ausencias" ? <Absences orgId={orgId} month={month} /> : null}
    </>
  );
}

async function Billing({ orgId, month }: { orgId: string; month: string }) {
  const { rows, totals } = await getBillingReport(orgId, month);
  return (
    <>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Facturado" value={totals.invoiced} format="currency" icon={Euro} tone="success" />
        <StatCard
          index={1}
          label="Por facturar"
          value={totals.toInvoice}
          format="currency"
          icon={Receipt}
          hint="OT cerradas sin facturar"
          tone={totals.toInvoice ? "warning" : undefined}
        />
        <StatCard index={2} label="En curso" value={totals.inProgress} format="currency" icon={Timer} hint="Lo imputado en OT abiertas" />
        <StatCard index={3} label="Horas imputadas" value={totals.hours * 60} format="minutes" icon={Clock3} />
      </div>
      <Card className="mt-4">
        <CardBody className="p-0">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead className="border-b border-border text-[12px] text-muted-foreground">
                  <tr>
                    <th className={TH}>Cliente · Proyecto</th>
                    <th className={TH}>Orden de trabajo</th>
                    <th className={TH}>Estado</th>
                    <th className={cn(TH, "text-right")}>Horas</th>
                    <th className={cn(TH, "text-right")}>Tarifa</th>
                    <th className={cn(TH, "text-right")}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.code} className="border-b border-border last:border-b-0">
                      <td className={TD}>
                        <span className="font-medium">{r.client}</span>
                        <span className="text-muted-foreground"> · {r.project}</span>
                      </td>
                      <td className={TD}>
                        <span className="font-mono text-[12px] text-muted-foreground">{r.code}</span> {r.workOrder}
                      </td>
                      <td className={TD}>
                        {r.billing === "invoiced" ? (
                          <Badge tone="success">Facturada</Badge>
                        ) : r.status === "Cerrada" ? (
                          <Badge tone="warning">Por facturar</Badge>
                        ) : (
                          <Badge tone="neutral">{r.status}</Badge>
                        )}
                      </td>
                      <td className={cn(TD, "text-right tabular")}>
                        {fmtH(r.loggedHours)}
                        {r.budgetedHours ? <span className="text-muted-foreground"> / {r.budgetedHours}</span> : null}
                      </td>
                      <td className={cn(TD, "text-right tabular text-muted-foreground")}>
                        {r.hourlyRate === null ? "Interno" : `${r.hourlyRate} €/h`}
                      </td>
                      <td className={cn(TD, "text-right font-medium tabular")}>{formatMoney(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border-strong bg-muted/40 font-semibold">
                  <tr>
                    <td className={TD} colSpan={3}>
                      Total
                    </td>
                    <td className={cn(TD, "text-right tabular")}>{fmtH(totals.hours)}</td>
                    <td className={TD} />
                    <td className={cn(TD, "text-right tabular")}>{formatMoney(totals.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Receipt}
              title="Sin órdenes de trabajo este mes"
              description="Cuando haya OT en el período, su facturación aparece acá."
            />
          )}
        </CardBody>
      </Card>
    </>
  );
}

async function Hours({ orgId, month }: { orgId: string; month: string }) {
  const { rows, projects, partial } = await getHoursReport(orgId, month);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const capacity = sum((r) => r.capacityHours);
  return (
    <>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <StatCard index={0} label="Horas fichadas" value={sum((r) => r.clockHours) * 60} format="minutes" icon={Clock3} />
        <StatCard index={1} label="Imputadas a proyectos" value={sum((r) => r.taskHours) * 60} format="minutes" icon={Timer} />
        <StatCard
          index={2}
          label="Dedicación del equipo"
          value={capacity ? Math.round((sum((r) => r.taskHours) / capacity) * 100) : 0}
          format="percent"
          icon={Gauge}
          hint={`sobre ${fmtH(capacity)} de capacidad${partial ? " hasta hoy" : ""}`}
        />
      </div>
      <Card className="mt-4">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="border-b border-border text-[12px] text-muted-foreground">
                <tr>
                  <th className={TH}>Persona</th>
                  <th className={cn(TH, "text-right")}>Fichadas</th>
                  <th className={cn(TH, "text-right")}>Imputadas</th>
                  <th className={cn(TH, "w-48")}>Dedicación</th>
                  {projects.map((p) => (
                    <th key={p.id} className={cn(TH, "text-right")}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.memberId} className="border-b border-border last:border-b-0">
                    <td className={cn(TD, "font-medium")}>{r.name}</td>
                    <td className={cn(TD, "text-right tabular")}>{fmtH(r.clockHours)}</td>
                    <td className={cn(TD, "text-right tabular")}>{fmtH(r.taskHours)}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={r.taskHours}
                          max={r.capacityHours || 1}
                          tone={(r.utilization ?? 0) > 100 ? "danger" : "accent"}
                        />
                        <span className="w-10 text-right text-[12px] text-muted-foreground tabular">{r.utilization ?? 0} %</span>
                      </div>
                    </td>
                    {projects.map((p) => (
                      <td key={p.id} className={cn(TD, "text-right tabular", !r.byProject[p.id] && "text-muted-foreground/50")}>
                        {r.byProject[p.id] ? fmtH(r.byProject[p.id]) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

async function Absences({ orgId, month }: { orgId: string; month: string }) {
  const rows = await getAbsencesReport(orgId, month);
  const kinds = ["vacation", "personal", "sick", "other"] as const;
  const out = rows.filter((r) => r.total > 0);
  return (
    <>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <StatCard
          index={0}
          label="Días de ausencia en el mes"
          value={rows.reduce((s, r) => s + r.total, 0)}
          format="days"
          icon={CalendarCheck2}
        />
        <StatCard index={1} label="Personas con ausencias" value={out.length} icon={UserX} hint={`de ${rows.length}`} />
        <StatCard index={2} label="Días de baja médica" value={rows.reduce((s, r) => s + r.days.sick, 0)} format="days" icon={Timer} />
      </div>
      <Card className="mt-4">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="border-b border-border text-[12px] text-muted-foreground">
                <tr>
                  <th className={TH}>Persona</th>
                  {kinds.map((k) => (
                    <th key={k} className={cn(TH, "text-right")}>
                      {ABSENCE_LABEL[k]}
                    </th>
                  ))}
                  <th className={cn(TH, "text-right")}>Total del mes</th>
                  <th className={cn(TH, "text-right")}>Vacaciones disponibles</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.memberId} className="border-b border-border last:border-b-0">
                    <td className={cn(TD, "font-medium")}>{r.name}</td>
                    {kinds.map((k) => (
                      <td key={k} className={cn(TD, "text-right tabular", !r.days[k] && "text-muted-foreground/50")}>
                        {r.days[k] || "—"}
                      </td>
                    ))}
                    <td className={cn(TD, "text-right font-medium tabular")}>{r.total}</td>
                    <td className={cn(TD, "text-right tabular")}>
                      {r.available} <span className="text-muted-foreground">de {r.allowance}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
