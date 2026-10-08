import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { getAbsences, getHolidays } from "@/lib/data/calendar";
import { getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProjects, getTasks } from "@/lib/data/projects";
import { requirePermission } from "@/lib/data/session";
import { getWorkOrdersInRange } from "@/lib/data/work-orders";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { displayName } from "@/lib/domain/hierarchy";
import {
  addDays,
  formatMonth,
  formatRange,
  monthStart,
  parseMonthParam,
  todayISO,
  weeksOfMonth,
  type ISODate,
  type Week,
} from "@/lib/domain/periods";
import { canManageProject } from "@/lib/domain/projects";
import { workOrderCode } from "@/lib/domain/work-orders";
import { cn } from "@/lib/utils";
import { CalendarView } from "./calendar-view";
import { HolidaysPanel } from "./holidays-panel";

export const metadata: Metadata = { title: "Calendario" };

function mondayOf(iso: ISODate): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

export default async function CalendarPage({ params, searchParams }: PageProps<"/app/[orgId]/calendar">) {
  const { orgId } = await params;
  const sp = await searchParams;
  const view = sp.view === "week" ? "week" : "month";
  const today = todayISO();

  let weeks: Week[];
  let month: ISODate | null = null;
  if (view === "week") {
    const weekParam = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today;
    const start = mondayOf(weekParam);
    weeks = [{ start, end: addDays(start, 6) }];
  } else {
    month = parseMonthParam(sp.month) ?? monthStart(today);
    weeks = weeksOfMonth(month);
  }
  const from = weeks[0].start;
  const to = weeks[weeks.length - 1].end;

  const ctx = await requirePermission(orgId, "workspace.access");
  const [tasks, projects, workOrders, absences, holidays, employees, headed] = await Promise.all([
    getTasks(orgId),
    getProjects(orgId),
    getWorkOrdersInRange(orgId, from, to),
    getAbsences(orgId, from, to),
    getHolidays(orgId, from, to),
    getEmployees(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
  ]);

  const access = { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set<string>() };
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));

  const events: CalendarEvent[] = [
    ...tasks
      .filter((t) => t.due_date && (t.start_date ?? t.due_date) <= to && t.due_date >= from)
      .map((t): CalendarEvent => {
        const project = projectById.get(t.project_id);
        return {
          id: `task:${t.id}`,
          kind: "task",
          title: t.title,
          subtitle: [project?.name, t.assigned_to ? names.get(t.assigned_to) : null].filter(Boolean).join(" · "),
          start: t.start_date ?? t.due_date!,
          end: t.due_date!,
          hasStart: t.start_date !== null,
          href: t.work_order_id ? `/app/work-orders/${t.work_order_id}` : `/app/projects/${t.project_id}`,
          status: t.status,
          mine: t.assigned_to === ctx.membership.id,
          movable: !!project && canManageProject(access, project) && t.status !== "done",
        };
      }),
    ...workOrders.map(
      (w): CalendarEvent => ({
        id: `wo:${w.id}`,
        kind: "workOrder",
        title: `${workOrderCode(w.number)} · ${w.title}`,
        subtitle: projectById.get(w.project_id)?.name,
        start: w.period_start,
        end: w.period_end,
        href: `/app/work-orders/${w.id}`,
        status: w.status,
      }),
    ),
    ...absences.map(
      (a, i): CalendarEvent => ({
        id: `abs:${a.membership_id}:${a.start_date}:${i}`,
        kind: "absence",
        title: `${names.get(a.membership_id) ?? "Alguien"}${a.status === "pending" ? " (pendiente)" : ""}`,
        subtitle: "Vacaciones",
        start: a.start_date,
        end: a.end_date,
        href: `/app/vacations`,
        status: a.status,
        mine: a.membership_id === ctx.membership.id,
      }),
    ),
    ...holidays.map((h): CalendarEvent => ({ id: `hol:${h.id}`, kind: "holiday", title: h.name, start: h.date, end: h.date })),
  ];

  const base = `/app/calendar`;
  const weekHref = Object.fromEntries(weeks.map((w) => [w.start, `${base}?view=week&week=${w.start}`]));
  const navBtn =
    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  const tab = (active: boolean) =>
    cn("inline-flex h-8 items-center rounded-lg px-3 text-[13px] transition-colors", active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground");

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <Link href={`${base}?month=${(month ?? weeks[0].start).slice(0, 7)}`} className={tab(view === "month")}>
          Mes
        </Link>
        <Link href={`${base}?view=week&week=${view === "week" ? weeks[0].start : mondayOf(today)}`} className={tab(view === "week")}>
          Semana
        </Link>
      </div>
      {view === "month" && month ? (
        <MonthNav month={month} basePath={base} />
      ) : (
        <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          <Link href={`${base}?view=week&week=${addDays(weeks[0].start, -7)}`} className={navBtn} aria-label="Semana anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 px-2 text-center text-[14px] font-semibold tracking-tight">
            {formatRange(weeks[0].start, weeks[0].end)}
          </span>
          <Link href={`${base}?view=week&week=${addDays(weeks[0].start, 7)}`} className={navBtn} aria-label="Semana siguiente">
            <ChevronRight className="size-4" />
          </Link>
          <Link href={`${base}?view=week&week=${mondayOf(today)}`} className="ml-1 inline-flex h-9 items-center rounded-xl px-3 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground">
            Hoy
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow={view === "week" ? formatMonth(weeks[0].start) : undefined}
        title="Calendario"
        description="Tareas, órdenes de trabajo, ausencias del equipo y festivos en un solo lugar."
        actions={toolbar}
      />
      <CalendarView
        key={`${view}-${from}`}
        orgId={orgId}
        events={events}
        weeks={weeks}
        monthStart={month}
        view={view}
        weekHref={weekHref}
      />
      {ctx.can("holidays.manage") ? <HolidaysPanel orgId={orgId} year={Number((month ?? from).slice(0, 4))} /> : null}
    </>
  );
}
