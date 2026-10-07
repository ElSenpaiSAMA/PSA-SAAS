import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Clock3, Gauge, ListTodo, Palmtree } from "lucide-react";
import { ClockWidget } from "@/components/app/clock-widget";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAbsences, getHolidays, getHolidaySet } from "@/lib/data/calendar";
import { getEmployees } from "@/lib/data/employees";
import { getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getMyEntriesSince, getWeekEntriesFor } from "@/lib/data/time";
import { getVisibleVacationRequests } from "@/lib/data/vacations";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { clockState, closedMinutes, entryMinutes, isSameDay, startOfWeek, workloadLevel, workloadPercent } from "@/lib/domain/time";
import { vacationBalance } from "@/lib/domain/vacations";
import { addDays, todayISO } from "@/lib/domain/periods";
import { aiEnabled } from "@/lib/ai/openrouter";
import { TeamSummary } from "./team-summary";
import { Upcoming, type UpcomingItem } from "./upcoming";

export const metadata: Metadata = { title: "Inicio" };

const STATUS_LABEL = { todo: "Por hacer", in_progress: "En curso", done: "Hecha" } as const;

export default async function DashboardPage({ params }: PageProps<"/app/[orgId]/dashboard">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership;
  const now = new Date();
  const weekStart = startOfWeek(now);

  const [entries, tasks, projects, minutes, employees] = await Promise.all([
    getMyEntriesSince(me.id, weekStart.toISOString()),
    getTasks(orgId),
    getProjects(orgId),
    getTaskMinutes(orgId),
    getEmployees(orgId),
  ]);

  const supervised = ctx.can("vacations.approve") || ctx.can("time.view_team")
    ? supervisedIds(employees, me.id, ctx.can("employees.manage"))
    : new Set<string>();

  const [requests, teamEntries] = await Promise.all([
    getVisibleVacationRequests([me.id, ...supervised]),
    ctx.can("time.view_team") ? getWeekEntriesFor([...supervised]) : Promise.resolve([]),
  ]);

  const clock = entries.filter((e) => e.entry_type === "clock");
  const clockNow = clockState(entries);
  const todayEntries = entries.filter((e) => isSameDay(new Date(e.started_at), now));
  const weekMinutes = clock.reduce((s, e) => s + entryMinutes(e, now), 0);
  const load = workloadPercent(weekMinutes, me.weekly_hours);
  const level = workloadLevel(load);

  const balance = vacationBalance(
    me.annual_vacation_days,
    requests.filter((r) => r.membership_id === me.id),
    now.getFullYear(),
    await getHolidaySet(orgId, `${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`),
  );
  const pendingApprovals = ctx.can("vacations.approve")
    ? requests.filter((r) => r.status === "pending" && supervised.has(r.membership_id)).length
    : 0;

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const myTasks = tasks
    .filter((t) => t.assigned_to === me.id && t.status !== "done")
    .sort((a, b) => (a.status === "in_progress" ? -1 : 0) - (b.status === "in_progress" ? -1 : 0))
    .slice(0, 5);

  const byId = new Map(employees.map((e) => [e.id, e]));
  const workingNow = [...new Set(teamEntries.filter((e) => e.entry_type === "clock" && !e.ended_at).map((e) => e.membership_id))]
    .map((id) => byId.get(id))
    .filter((e) => e !== undefined);

  const firstName = displayName(employees.find((e) => e.id === me.id)?.profile ?? null).split(" ")[0];

  // Agenda de la semana: mis vencimientos, ausencias del equipo y festivos
  const today = todayISO(now);
  const weekEnd = addDays(today, 6);
  const [absencesSoon, holidaysSoon] = await Promise.all([getAbsences(orgId, today, weekEnd), getHolidays(orgId, today, weekEnd)]);
  const upcoming: UpcomingItem[] = [
    ...tasks
      .filter((t) => t.assigned_to === me.id && t.status !== "done" && t.due_date && t.due_date >= today && t.due_date <= weekEnd)
      .map((t) => ({
        date: t.due_date!,
        kind: "task" as const,
        title: `Vence: ${t.title}`,
        href: t.work_order_id ? `/app/${orgId}/work-orders/${t.work_order_id}` : `/app/${orgId}/projects/${t.project_id}`,
      })),
    ...absencesSoon
      .filter((a) => a.status === "approved")
      .flatMap((a) => {
        const name = displayName(byId.get(a.membership_id)?.profile ?? null);
        const start = a.start_date < today ? today : a.start_date;
        return [{ date: start, kind: "absence" as const, title: `${name} de vacaciones hasta el ${Number(a.end_date.slice(8))}/${Number(a.end_date.slice(5, 7))}`, href: `/app/${orgId}/calendar` }];
      }),
    ...holidaysSoon.map((h) => ({ date: h.date, kind: "holiday" as const, title: `Festivo: ${h.name}` })),
  ];

  return (
    <>
      <PageHeader
        eyebrow={now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        title={`Hola, ${firstName}.`}
        accent={clockNow.status === "paused" ? "Buen provecho." : clockNow.status === "working" ? "Buen ritmo hoy." : "¿Arrancamos?"}
      />

      <ClockWidget
        orgId={orgId}
        state={clockNow}
        workedMinutes={closedMinutes(todayEntries, "clock")}
        breakMinutes={closedMinutes(todayEntries, "break")}
      />

      <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Horas esta semana" value={weekMinutes} format="minutes" icon={Clock3} hint={`de ${me.weekly_hours}h contratadas`} />
        <StatCard
          index={1}
          label="Carga semanal"
          value={load}
          format="percent"
          icon={Gauge}
          tone={level === "overloaded" ? "danger" : level === "high" ? "warning" : undefined}
          hint={{ low: "Semana tranquila", healthy: "En rango saludable", high: "Cerca del límite", overloaded: "Por encima de tu capacidad" }[level]}
        />
        <StatCard index={2} label="Vacaciones disponibles" value={balance.available} format="days" icon={Palmtree} hint={balance.pending ? `${balance.pending} pendientes de aprobar` : `de ${balance.allowance} este año`} />
        <StatCard index={3} label="Tareas abiertas" value={tasks.filter((t) => t.assigned_to === me.id && t.status !== "done").length} icon={ListTodo} hint="Asignadas a vos" />
      </div>

      {pendingApprovals > 0 ? (
        <Link
          href={`/app/${orgId}/vacations`}
          className="group mt-4 flex items-center gap-4 rounded-2xl border border-warning/30 bg-warning/[0.06] p-4 transition-colors hover:bg-warning/10"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <CalendarClock className="size-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium">
              {pendingApprovals} {pendingApprovals === 1 ? "solicitud de vacaciones espera" : "solicitudes de vacaciones esperan"} tu aprobación
            </p>
            <p className="text-[12.5px] text-muted-foreground">De personas de tu equipo</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      ) : null}

      <div className={ctx.can("time.view_team") ? "mt-4 grid gap-4 lg:grid-cols-2 lg:items-start" : "mt-4"}>
        <Upcoming orgId={orgId} today={today} items={upcoming} />
        {ctx.can("time.view_team") ? <TeamSummary orgId={orgId} enabled={aiEnabled()} /> : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Tus tareas"
            action={
              <Link href={`/app/${orgId}/projects`} className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
                Ver proyectos →
              </Link>
            }
          />
          <CardBody className="pt-3">
            {myTasks.length === 0 ? (
              <EmptyState icon={ListTodo} title="Nada pendiente" description="No tenés tareas abiertas asignadas." className="py-8" />
            ) : (
              <ul className="divide-y divide-border">
                {myTasks.map((t) => {
                  const logged = (minutes.get(t.id) ?? 0) / 60;
                  return (
                    <li key={t.id}>
                      <Link href={`/app/${orgId}/projects/${t.project_id}`} className="group flex items-center gap-3 py-3">
                        <span className={t.status === "in_progress" ? "size-2 rounded-full bg-accent" : "size-2 rounded-full bg-border-strong"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium transition-colors group-hover:text-accent">{t.title}</p>
                          <p className="truncate text-[12px] text-muted-foreground">{projectName.get(t.project_id)}</p>
                        </div>
                        <span className="text-[12px] text-muted-foreground tabular">
                          {Math.round(logged * 10) / 10}
                          {t.estimated_hours ? `/${t.estimated_hours}h` : "h"}
                        </span>
                        <Badge tone={t.status === "in_progress" ? "accent" : "neutral"} className="hidden sm:inline-flex">
                          {STATUS_LABEL[t.status]}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        {ctx.can("time.view_team") ? (
          <Card>
            <CardHeader title="Tu equipo ahora" description={`${workingNow.length} de ${supervised.size} trabajando`} />
            <CardBody>
              {workingNow.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nadie fichado en este momento.</p>
              ) : (
                <ul className="grid gap-3">
                  {workingNow.map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar name={displayName(e.profile)} size={34} />
                        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium">{displayName(e.profile)}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{e.position ?? "—"}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/app/${orgId}/time-tracking`} className="mt-5 inline-block text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
                Ver carga del equipo →
              </Link>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <SectionTitle>Atajos</SectionTitle>
              <div className="grid gap-2">
                {[
                  { href: "vacations", label: "Solicitar vacaciones", icon: Palmtree },
                  { href: "time-tracking", label: "Imputar horas a una tarea", icon: Clock3 },
                ].map((a) => (
                  <Link
                    key={a.href}
                    href={`/app/${orgId}/${a.href}`}
                    className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-border-strong"
                  >
                    <a.icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
                    <span className="flex-1 text-[13.5px]">{a.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-muted-foreground">
                Tip: presioná <kbd className="rounded border border-border px-1 font-mono">⌘K</kbd> para ir a cualquier lado.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
