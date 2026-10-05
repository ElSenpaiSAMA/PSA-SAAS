import type { Metadata } from "next";
import { ClockWidget } from "@/components/app/clock-widget";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getEmployees } from "@/lib/data/employees";
import { getProjects, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getMyEntriesSince, getWeekEntriesFor } from "@/lib/data/time";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { entryMinutes, formatMinutes, isSameDay, startOfDay, startOfWeek } from "@/lib/domain/time";
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

  const [entries, tasks, projects] = await Promise.all([
    getMyEntriesSince(me.id, since.toISOString()),
    getTasks(orgId),
    getProjects(orgId),
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const myTasks = tasks
    .filter((t) => t.assigned_to === me.id && t.status !== "done")
    .map((t) => ({ id: t.id, title: t.title, projectName: projectName.get(t.project_id) ?? "Proyecto" }));

  const open = entries.find((e) => e.entry_type === "clock" && e.ended_at === null) ?? null;
  const now = new Date();
  const todayMinutes = entries
    .filter((e) => e.entry_type === "clock" && isSameDay(new Date(e.started_at), now))
    .reduce((s, e) => s + entryMinutes(e, now), 0);
  const weekStart = startOfWeek(now);
  const thisWeek = entries.filter((e) => new Date(e.started_at) >= weekStart);
  const weekClock = thisWeek.filter((e) => e.entry_type === "clock").reduce((s, e) => s + entryMinutes(e, now), 0);

  let team: { members: Parameters<typeof TeamWorkload>[0]["members"]; entries: Parameters<typeof TeamWorkload>[0]["entries"] } | null = null;
  if (ctx.can("time.view_team")) {
    const employees = await getEmployees(orgId);
    const visible = supervisedIds(employees, me.id, ctx.can("employees.manage"));
    const members = employees
      .filter((e) => visible.has(e.id) && e.status === "active")
      .map((e) => ({ membershipId: e.id, name: displayName(e.profile), position: e.position, weeklyHours: e.weekly_hours }));
    team = { members, entries: await getWeekEntriesFor(members.map((m) => m.membershipId)) };
  }

  return (
    <>
      <PageHeader
        eyebrow={startOfDay(now).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        title="Fichaje"
        accent="y horas"
        description="Registrá tu jornada e imputá horas a las tareas en las que trabajaste."
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ClockWidget orgId={orgId} openSince={open?.started_at ?? null} todayMinutes={todayMinutes} size="lg" />
        <Card>
          <CardHeader title="Imputar horas" description="A una de tus tareas abiertas" />
          <CardBody>
            <LogHoursForm orgId={orgId} tasks={myTasks} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Esta semana"
          description={`${formatMinutes(weekClock)} fichadas de ${me.weekly_hours}h contratadas`}
        />
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
        <EntriesList orgId={orgId} entries={entries} />
      </div>
    </>
  );
}
