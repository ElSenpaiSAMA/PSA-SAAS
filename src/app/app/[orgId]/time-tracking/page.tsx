import type { Metadata } from "next";
import { ClockWidget } from "@/components/app/clock-widget";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getEmployees } from "@/lib/data/employees";
import { getProjects, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getHolidays } from "@/lib/data/calendar";
import {
  getCorrections,
  getMyApprovedAbsences,
  getMyEntriesBetween,
  getMyEntriesSince,
  getTimeEntriesById,
  getWeekEntriesFor,
} from "@/lib/data/time";
import { getAllWorkOrders } from "@/lib/data/work-orders";
import { acceptsTimeEntries, workOrderCode } from "@/lib/domain/work-orders";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { addDays, todayISO } from "@/lib/domain/periods";
import {
  clockState,
  closedMinutes,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "@/lib/domain/time";
import { ABSENCE_LABEL } from "@/lib/domain/vacations";
import {
  MyCorrections,
  TeamCorrections,
  type CorrectionView,
} from "./corrections-list";
import { aiEnabled } from "@/lib/ai/openrouter";
import { AiAllocation } from "./ai-allocation";
import { LogHoursForm } from "./log-hours-form";
import { TeamWorkload } from "./team-workload";
import { Timesheet } from "./timesheet";

export const metadata: Metadata = { title: "Fichaje y horas" };

export default async function TimeTrackingPage({
  params,
  searchParams,
}: PageProps<"/app/[orgId]/time-tracking">) {
  const { orgId } = await params;
  const { semana } = await searchParams;
  // Semana pedida (lunes, AAAA-MM-DD); sin parámetro, el navegador muestra la actual
  const weekParam =
    typeof semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(semana)
      ? semana
      : null;
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership;

  // Rango amplio alrededor de la semana: el servidor corre en UTC y el navegador agrupa
  // por día con su propia zona horaria
  const base = weekParam ?? todayISO(startOfWeek(new Date()));
  // Lo de hoy (para el reloj), con margen por la zona horaria
  const twoDaysAgo = startOfDay(new Date());
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const from = addDays(base, -2);
  const to = addDays(base, 9);

  const [
    entries,
    weekEntries,
    tasks,
    projects,
    workOrders,
    myCorrectionRows,
    holidays,
    absences,
  ] = await Promise.all([
    getMyEntriesSince(me.id, twoDaysAgo.toISOString()),
    getMyEntriesBetween(me.id, `${from}T00:00:00Z`, `${to}T00:00:00Z`),
    getTasks(orgId),
    getProjects(orgId),
    getAllWorkOrders(orgId),
    getCorrections([me.id]),
    getHolidays(orgId, from, to),
    getMyApprovedAbsences(me.id, from, to),
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const workOrderById = new Map(workOrders.map((w) => [w.id, w]));
  // Solo tareas de OT abiertas (aprobadas o en curso) admiten horas; se agrupan por OT
  const myTasks = tasks
    .filter((t) => t.assigned_to === me.id && t.status !== "done")
    .filter((t) => {
      const wo = t.work_order_id
        ? workOrderById.get(t.work_order_id)
        : undefined;
      return (
        !t.work_order_id || (wo !== undefined && acceptsTimeEntries(wo.status))
      );
    })
    .map((t) => {
      const wo = t.work_order_id
        ? workOrderById.get(t.work_order_id)
        : undefined;
      return {
        id: t.id,
        title: t.title,
        projectName: wo
          ? `${workOrderCode(wo.number)} · ${wo.title}`
          : (projectName.get(t.project_id) ?? "Proyecto"),
      };
    });

  const now = new Date();
  const state = clockState(entries);
  const today = entries.filter((e) => isSameDay(new Date(e.started_at), now));

  // Horario anterior de cada tramo a corregir (para mostrar "antes → después")
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const toView = (
    c: (typeof myCorrectionRows)[number],
    name: string,
    entry?: { started_at: string; ended_at: string | null },
  ): CorrectionView => ({
    ...c,
    name,
    previous:
      c.status === "pending" && entry
        ? { started_at: entry.started_at, ended_at: entry.ended_at }
        : null,
  });
  const myCorrections = myCorrectionRows
    .slice(0, 8)
    .map((c) =>
      toView(c, "", c.entry_id ? entryById.get(c.entry_id) : undefined),
    );

  let team: {
    members: Parameters<typeof TeamWorkload>[0]["members"];
    entries: Parameters<typeof TeamWorkload>[0]["entries"];
  } | null = null;
  let teamCorrections: CorrectionView[] = [];
  if (ctx.can("time.view_team")) {
    const employees = await getEmployees(orgId);
    const visible = supervisedIds(
      employees,
      me.id,
      ctx.can("employees.manage"),
    );
    const members = employees
      .filter((e) => visible.has(e.id) && e.status === "active")
      .map((e) => ({
        membershipId: e.id,
        name: displayName(e.profile),
        position: e.position,
        weeklyHours: e.weekly_hours,
      }));
    const [teamEntries, corrections] = await Promise.all([
      getWeekEntriesFor(members.map((m) => m.membershipId)),
      getCorrections(members.map((m) => m.membershipId)),
    ]);
    team = { members, entries: teamEntries };
    const pendingTeam = corrections.filter((c) => c.status === "pending");
    // Horarios actuales de los tramos a corregir (pueden ser de hace más de una semana)
    const previous = await getTimeEntriesById(
      pendingTeam.flatMap((c) => (c.entry_id ? [c.entry_id] : [])),
    );
    const names = new Map(members.map((m) => [m.membershipId, m.name]));
    teamCorrections = pendingTeam.map((c) =>
      toView(
        c,
        names.get(c.membership_id) ?? "Alguien",
        c.entry_id ? previous.get(c.entry_id) : undefined,
      ),
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={startOfDay(now).toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
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

      <ClockWidget
        orgId={orgId}
        state={state}
        workedMinutes={closedMinutes(today, "clock")}
        breakMinutes={closedMinutes(today, "break")}
      />

      <div className="mt-4">
        <Timesheet
          orgId={orgId}
          weekParam={weekParam}
          entries={weekEntries}
          expectedPerDayMin={Math.round((me.weekly_hours / 5) * 60)}
          holidays={holidays.map((h) => ({ date: h.date, name: h.name }))}
          absences={absences.map((a) => ({
            start_date: a.start_date,
            end_date: a.end_date,
            label:
              ABSENCE_LABEL[a.kind as keyof typeof ABSENCE_LABEL] ?? "Ausencia",
          }))}
          pendingEntryIds={myCorrectionRows.flatMap((c) =>
            c.status === "pending" && c.entry_id ? [c.entry_id] : [],
          )}
          logSlot={
            <Card>
              <CardHeader
                title="Imputar horas"
                description="A una de tus tareas abiertas"
              />
              <CardBody className="grid gap-4">
                <LogHoursForm orgId={orgId} tasks={myTasks} />
                <AiAllocation orgId={orgId} enabled={aiEnabled()} />
              </CardBody>
            </Card>
          }
        />
      </div>

      {team && team.members.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Carga del equipo"
            description={
              ctx.can("employees.manage")
                ? "Toda la organización, esta semana"
                : "Tu línea de reporte, esta semana"
            }
          />
          <CardBody>
            <TeamWorkload members={team.members} entries={team.entries} />
          </CardBody>
        </Card>
      ) : null}

      {myCorrections.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Mis correcciones"
            description="Fichajes que pediste corregir"
          />
          <CardBody>
            <MyCorrections orgId={orgId} items={myCorrections} />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
