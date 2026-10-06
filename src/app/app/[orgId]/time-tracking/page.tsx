import type { Metadata } from "next";
import { ClockWidget } from "@/components/app/clock-widget";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getEmployees } from "@/lib/data/employees";
import { getProjects, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getCorrections, getMyEntriesSince, getTimeEntriesById, getWeekEntriesFor } from "@/lib/data/time";
import { getAllWorkOrders } from "@/lib/data/work-orders";
import { acceptsTimeEntries, workOrderCode } from "@/lib/domain/work-orders";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { clockState, closedMinutes, entryMinutes, formatMinutes, isSameDay, startOfDay, startOfWeek } from "@/lib/domain/time";
import { MyCorrections, TeamCorrections, type CorrectionView } from "./corrections-list";
import { aiEnabled } from "@/lib/ai/openrouter";
import { AiAllocation } from "./ai-allocation";
import { EntriesList } from "./entries-list";
import { LogHoursForm } from "./log-hours-form";
import { TeamWorkload } from "./team-workload";
import { WeekChart } from "./week-chart";

export const metadata: Metadata = { title: "Fichaje y horas" };

export default async function TimeTrackingPage({ params }: PageProps<"/app/[orgId]/time-tracking">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership;

  // Dos semanas de historial; la semana actual alimenta el gráfico
  const since = startOfWeek(new Date());
  since.setDate(since.getDate() - 7);

  const [entries, tasks, projects, workOrders, myCorrectionRows] = await Promise.all([
    getMyEntriesSince(me.id, since.toISOString()),
    getTasks(orgId),
    getProjects(orgId),
    getAllWorkOrders(orgId),
    getCorrections([me.id]),
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const workOrderById = new Map(workOrders.map((w) => [w.id, w]));
  // Solo tareas de OT abiertas (aprobadas o en curso) admiten horas; se agrupan por OT
  const myTasks = tasks
    .filter((t) => t.assigned_to === me.id && t.status !== "done")
    .filter((t) => {
      const wo = t.work_order_id ? workOrderById.get(t.work_order_id) : undefined;
      return !t.work_order_id || (wo !== undefined && acceptsTimeEntries(wo.status));
    })
    .map((t) => {
      const wo = t.work_order_id ? workOrderById.get(t.work_order_id) : undefined;
      return {
        id: t.id,
        title: t.title,
        projectName: wo ? `${workOrderCode(wo.number)} · ${wo.title}` : (projectName.get(t.project_id) ?? "Proyecto"),
      };
    });

  const now = new Date();
  const state = clockState(entries);
  const today = entries.filter((e) => isSameDay(new Date(e.started_at), now));
  const weekStart = startOfWeek(now);
  const thisWeek = entries.filter((e) => new Date(e.started_at) >= weekStart);
  const weekClock = thisWeek.filter((e) => e.entry_type === "clock").reduce((s, e) => s + entryMinutes(e, now), 0);

  // Horario anterior de cada tramo a corregir (para mostrar "antes → después")
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const toView = (
    c: (typeof myCorrectionRows)[number],
    name: string,
    entry?: { started_at: string; ended_at: string | null },
  ): CorrectionView => ({
    ...c,
    name,
    previous: c.status === "pending" && entry ? { started_at: entry.started_at, ended_at: entry.ended_at } : null,
  });
  const myCorrections = myCorrectionRows.slice(0, 8).map((c) => toView(c, "", c.entry_id ? entryById.get(c.entry_id) : undefined));

  let team: { members: Parameters<typeof TeamWorkload>[0]["members"]; entries: Parameters<typeof TeamWorkload>[0]["entries"] } | null =
    null;
  let teamCorrections: CorrectionView[] = [];
  if (ctx.can("time.view_team")) {
    const employees = await getEmployees(orgId);
    const visible = supervisedIds(employees, me.id, ctx.can("employees.manage"));
    const members = employees
      .filter((e) => visible.has(e.id) && e.status === "active")
      .map((e) => ({ membershipId: e.id, name: displayName(e.profile), position: e.position, weeklyHours: e.weekly_hours }));
    const [teamEntries, corrections] = await Promise.all([
      getWeekEntriesFor(members.map((m) => m.membershipId)),
      getCorrections(members.map((m) => m.membershipId)),
    ]);
    team = { members, entries: teamEntries };
    const pendingTeam = corrections.filter((c) => c.status === "pending");
    // Horarios actuales de los tramos a corregir (pueden ser de hace más de una semana)
    const previous = await getTimeEntriesById(pendingTeam.flatMap((c) => (c.entry_id ? [c.entry_id] : [])));
    const names = new Map(members.map((m) => [m.membershipId, m.name]));
    teamCorrections = pendingTeam.map((c) =>
      toView(c, names.get(c.membership_id) ?? "Alguien", c.entry_id ? previous.get(c.entry_id) : undefined),
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={startOfDay(now).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        title="Fichaje"
        accent="y horas"
        description="Registrá tu jornada e imputá horas a las tareas en las que trabajaste."
      />

      {teamCorrections.length > 0 ? (
        <Card id="correcciones" className="mb-4 border-warning/30">
          <CardHeader
            title={`Correcciones por decidir · ${teamCorrections.length}`}
            description="Fichajes que tu equipo pidió corregir. Al aprobar, se aplican solos."
          />
          <CardBody>
            <TeamCorrections orgId={orgId} items={teamCorrections} />
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ClockWidget
          orgId={orgId}
          state={state}
          workedMinutes={closedMinutes(today, "clock")}
          breakMinutes={closedMinutes(today, "break")}
          size="lg"
        />
        <Card>
          <CardHeader title="Imputar horas" description="A una de tus tareas abiertas" />
          <CardBody className="grid gap-4">
            <LogHoursForm orgId={orgId} tasks={myTasks} />
            <AiAllocation orgId={orgId} enabled={aiEnabled()} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Esta semana" description={`${formatMinutes(weekClock)} fichadas de ${me.weekly_hours}h contratadas`} />
        <CardBody className="pt-8">
          <WeekChart entries={thisWeek} dailyTargetMinutes={Math.round((me.weekly_hours / 5) * 60)} />
        </CardBody>
      </Card>

      {team && team.members.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Carga del equipo"
            description={ctx.can("employees.manage") ? "Toda la organización, esta semana" : "Tu línea de reporte, esta semana"}
          />
          <CardBody>
            <TeamWorkload members={team.members} entries={team.entries} />
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-10">
        <SectionTitle>Historial de las últimas dos semanas</SectionTitle>
        <EntriesList
          orgId={orgId}
          entries={entries}
          pendingEntryIds={myCorrectionRows.flatMap((c) => (c.status === "pending" && c.entry_id ? [c.entry_id] : []))}
        />
      </div>

      {myCorrections.length > 0 ? (
        <div className="mt-10">
          <SectionTitle>Mis correcciones</SectionTitle>
          <MyCorrections orgId={orgId} items={myCorrections} />
        </div>
      ) : null}
    </>
  );
}
