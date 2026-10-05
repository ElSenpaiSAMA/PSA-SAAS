import type { Metadata } from "next";
import { CalendarRange, Gauge, TriangleAlert, Users } from "lucide-react";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDepartments } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getOrgContext } from "@/lib/data/session";
import { getVisibleVacationRequests } from "@/lib/data/vacations";
import { getWorkloadItems } from "@/lib/data/work-orders";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { formatRange, monthEnd, monthStart, parseMonthParam, todayISO, weeksOfMonth } from "@/lib/domain/periods";
import { daysOffFrom, loadLevel, weekCapacity, weeklyLoad, type LoadLevel } from "@/lib/domain/planning";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Planificación" };

const LEVEL_STYLE: Record<LoadLevel, string> = {
  free: "bg-muted/50 text-muted-foreground/60",
  low: "bg-accent/10 text-foreground",
  healthy: "bg-success/15 text-foreground",
  high: "bg-warning/25 text-foreground",
  over: "bg-danger/20 font-semibold text-danger",
};

const LEGEND: { level: LoadLevel; label: string }[] = [
  { level: "free", label: "Libre" },
  { level: "low", label: "< 40%" },
  { level: "healthy", label: "40–85%" },
  { level: "high", label: "85–100%" },
  { level: "over", label: "Sobrecarga" },
];

export default async function PlanningPage({ params, searchParams }: PageProps<"/app/[orgId]/planning">) {
  const { orgId } = await params;
  const { month: monthParam } = await searchParams;
  const month = parseMonthParam(monthParam) ?? monthStart(todayISO());
  const from = month;
  const to = monthEnd(month);

  const ctx = await getOrgContext(orgId);
  const [employees, departments, items] = await Promise.all([
    getEmployees(orgId),
    getDepartments(orgId),
    getWorkloadItems(orgId, from, to),
  ]);

  // Uno mismo + a quien supervisa (toda la org si es admin)
  const visible = ctx.can("time.view_team")
    ? new Set([ctx.membership.id, ...supervisedIds(employees, ctx.membership.id, ctx.can("employees.manage"))])
    : new Set([ctx.membership.id]);
  const people = employees.filter((e) => e.status === "active" && visible.has(e.id));
  const vacations = (await getVisibleVacationRequests(people.map((p) => p.id))).filter(
    (v) => v.status === "approved" && v.end_date >= from && v.start_date <= to,
  );

  const weeks = weeksOfMonth(month);
  const load = weeklyLoad(items, weeks);

  const rows = people.map((p) => {
    const off = daysOffFrom(vacations.filter((v) => v.membership_id === p.id));
    const capacity = weeks.map((w) => weekCapacity(Number(p.weekly_hours), w, from, to, off));
    const planned = load.get(p.id) ?? weeks.map(() => 0);
    const totalPlanned = planned.reduce((s, h) => s + h, 0);
    const totalCapacity = capacity.reduce((s, h) => s + h, 0);
    return {
      person: p,
      name: displayName(p.profile),
      planned,
      capacity,
      totalPlanned,
      totalCapacity,
      overWeeks: planned.filter((h, i) => loadLevel(h, capacity[i]) === "over").length,
      daysOff: off.size,
    };
  });

  const totalPlanned = rows.reduce((s, r) => s + r.totalPlanned, 0);
  const totalCapacity = rows.reduce((s, r) => s + r.totalCapacity, 0);
  const overloaded = rows.filter((r) => r.overWeeks > 0).length;

  const groups = [
    ...departments.map((d) => ({ id: d.id, name: d.name, rows: rows.filter((r) => r.person.department_id === d.id) })),
    { id: "none", name: "Sin departamento", rows: rows.filter((r) => !r.person.department_id) },
  ].filter((g) => g.rows.length > 0);

  return (
    <>
      <PageHeader
        title="Planificación"
        description={
          ctx.can("time.view_team")
            ? "Horas planificadas en tareas contra la capacidad de cada persona, semana a semana. Las vacaciones aprobadas descuentan capacidad."
            : "Tus horas planificadas en tareas contra tu capacidad, semana a semana."
        }
        actions={<MonthNav month={month} basePath={`/app/${orgId}/planning`} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Personas" value={rows.length} icon={Users} />
        <StatCard index={1} label="Horas planificadas" value={totalPlanned * 60} format="minutes" icon={CalendarRange} hint={`de ${Math.round(totalCapacity)}h de capacidad`} />
        <StatCard
          index={2}
          label="Ocupación"
          value={totalCapacity ? (totalPlanned / totalCapacity) * 100 : 0}
          format="percent"
          icon={Gauge}
        />
        <StatCard
          index={3}
          label="Con sobrecarga"
          value={overloaded}
          icon={TriangleAlert}
          tone={overloaded ? "danger" : undefined}
          hint="Al menos una semana por encima de su capacidad"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Nada para planificar" className="mt-6" />
      ) : (
        <Card className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-card px-5 py-3 font-medium">Persona</th>
                  {weeks.map((w) => (
                    <th key={w.start} className="px-2 py-3 text-center font-medium whitespace-nowrap">
                      {formatRange(w.start < from ? from : w.start, w.end > to ? to : w.end)}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-medium">Mes</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.id}>
                  {departments.length > 0 ? (
                    <tr>
                      <td colSpan={weeks.length + 2} className="bg-muted/40 px-5 py-2 text-[12px] font-medium text-muted-foreground">
                        {g.name}
                      </td>
                    </tr>
                  ) : null}
                  {g.rows.map((r) => (
                    <tr key={r.person.id} className="border-b border-border last:border-b-0">
                      <td className="sticky left-0 z-10 bg-card px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name} size={30} className="ring-0" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {r.name}
                              {r.person.id === ctx.membership.id ? <span className="font-normal text-muted-foreground"> (vos)</span> : null}
                            </p>
                            <p className="truncate text-[11.5px] text-muted-foreground">
                              {Number(r.person.weekly_hours)}h/sem{r.daysOff ? ` · ${r.daysOff} días de vacaciones` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      {weeks.map((w, i) => {
                        const level = loadLevel(r.planned[i], r.capacity[i]);
                        return (
                          <td key={w.start} className="px-1.5 py-2">
                            <div
                              title={`${r.planned[i]}h planificadas de ${r.capacity[i]}h de capacidad`}
                              className={cn("rounded-lg px-2 py-2 text-center tabular transition-colors", LEVEL_STYLE[level])}
                            >
                              {r.planned[i] ? `${r.planned[i]}h` : "—"}
                              <span className="block text-[10.5px] font-normal opacity-60">/ {r.capacity[i]}h</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-5 py-2.5 text-right tabular">
                        <span className="font-semibold">{Math.round(r.totalPlanned * 10) / 10}h</span>
                        <span className="block text-[11.5px] text-muted-foreground">de {Math.round(r.totalCapacity)}h</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
            {LEGEND.map((l) => (
              <span key={l.level} className="inline-flex items-center gap-1.5">
                <span className={cn("size-3 rounded", LEVEL_STYLE[l.level])} />
                {l.label}
              </span>
            ))}
            <span className="ml-auto">Las horas estimadas de cada tarea se reparten entre sus días hábiles.</span>
          </div>
        </Card>
      )}
    </>
  );
}
