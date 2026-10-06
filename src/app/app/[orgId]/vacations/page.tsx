import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarClock, CalendarDays, Palmtree, UserX, Users } from "lucide-react";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getHolidaySet } from "@/lib/data/calendar";
import { getEmployees } from "@/lib/data/employees";
import { getOrgContext } from "@/lib/data/session";
import { getVisibleVacationRequests } from "@/lib/data/vacations";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { monthStart, parseMonthParam, todayISO, toMonthParam } from "@/lib/domain/periods";
import { hasPermission, isRole } from "@/lib/domain/permissions";
import { absenceGrid, overlappingPeople } from "@/lib/domain/team-absences";
import { ABSENCE_LABEL, businessDays, naturalApprovers, vacationBalance } from "@/lib/domain/vacations";
import { cn } from "@/lib/utils";
import { Approvals, MyRequests, type PendingApproval } from "./request-list";
import { RequestForm } from "./request-form";
import { TeamCalendar, type TeamCalendarRow } from "./team-calendar";

export const metadata: Metadata = { title: "Vacaciones" };

const roleCan = (perm: "vacations.approve" | "employees.manage") => (role: string) => isRole(role) && hasPermission(role, perm);
const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? null) : `${names.slice(0, -1).join(", ")} o ${names.at(-1)}`);

export default async function VacationsPage({ params, searchParams }: PageProps<"/app/[orgId]/vacations">) {
  const { orgId } = await params;
  const { tab: tabParam, month: monthParam } = await searchParams;
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership;
  const today = todayISO();
  const year = Number(today.slice(0, 4));

  const employees = await getEmployees(orgId);
  const supervised = ctx.can("vacations.approve") ? supervisedIds(employees, me.id, ctx.can("employees.manage")) : new Set<string>();
  // La pestaña Equipo es solo para quien aprueba y tiene a alguien a cargo
  const isApprover = supervised.size > 0;
  const tab = isApprover && tabParam === "equipo" ? "equipo" : "mias";

  const requests = await getVisibleVacationRequests([me.id, ...supervised]);
  // Los festivos no cuentan como días de vacaciones
  const holidays = await getHolidaySet(orgId, `${year - 1}-01-01`, `${year + 1}-12-31`);
  const holidayList = [...holidays];
  const byId = new Map(employees.map((e) => [e.id, e]));
  const nameOf = (id: string) => displayName(byId.get(id)?.profile ?? null);
  const balanceOf = (id: string) =>
    vacationBalance(
      byId.get(id)?.annual_vacation_days ?? 0,
      requests.filter((r) => r.membership_id === id),
      year,
      holidays,
    );

  const pending = requests.filter((r) => r.status === "pending" && supervised.has(r.membership_id));
  const base = `/app/${orgId}/vacations`;

  const tabs = isApprover ? (
    <nav aria-label="Vacaciones" className="mb-6 inline-flex rounded-xl border border-border bg-muted/40 p-1">
      {[
        { key: "mias", label: "Mis vacaciones", href: base, count: 0 },
        { key: "equipo", label: "Equipo", href: `${base}?tab=equipo`, count: pending.length },
      ].map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={tab === t.key ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-lg px-3.5 text-[13px] transition-colors",
            tab === t.key ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count ? (
            <span className="min-w-5 rounded-full bg-warning px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular">
              {t.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  ) : null;

  // ── Pestaña "Equipo" ──────────────────────────────────────
  if (tab === "equipo") {
    const month = parseMonthParam(monthParam) ?? monthStart(today);
    const teamIds = employees
      .filter((e) => supervised.has(e.id) && e.status === "active")
      .sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id), "es"))
      .map((e) => e.id);
    const teamRequests = requests.filter((r) => supervised.has(r.membership_id));
    const { days, rows } = absenceGrid(teamIds, teamRequests, month, holidays);
    const calendarRows: TeamCalendarRow[] = rows.map((row) => ({
      ...row,
      name: nameOf(row.memberId),
      position: byId.get(row.memberId)?.position ?? null,
      available: balanceOf(row.memberId).available,
    }));

    const approvals: PendingApproval[] = pending
      .map((r) => {
        const natural = naturalApprovers(employees, r.membership_id, roleCan("vacations.approve"), roleCan("employees.manage"));
        return {
          ...r,
          name: nameOf(r.membership_id),
          position: byId.get(r.membership_id)?.position ?? null,
          available: balanceOf(r.membership_id).available,
          overlaps: overlappingPeople(r, teamRequests).map(nameOf),
          approverName: natural.includes(me.id) ? null : joinNames(natural.map(nameOf)),
        };
      })
      // Primero las que me tocan a mí, después por fecha de inicio
      .sort((a, b) => Number(!!a.approverName) - Number(!!b.approverName) || a.start_date.localeCompare(b.start_date));

    const outToday = teamRequests.filter((r) => r.status === "approved" && r.start_date <= today && r.end_date >= today);
    const upcoming = teamRequests
      .filter((r) => r.status === "approved" && r.start_date > today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 6);

    return (
      <>
        <PageHeader
          eyebrow={`Año ${year}`}
          title="Vacaciones"
          description="Las solicitudes de tu equipo, quién está fuera y cuándo. Decidí con el calendario a la vista."
        />
        {tabs}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard index={0} label="Por decidir" value={pending.length} icon={CalendarClock} tone={pending.length ? "warning" : undefined} />
          <StatCard
            index={1}
            label="Fuera hoy"
            value={new Set(outToday.map((r) => r.membership_id)).size}
            icon={UserX}
            hint={outToday.map((r) => nameOf(r.membership_id)).join(", ") || "Todo el equipo trabajando"}
          />
          <StatCard index={2} label="Personas a cargo" value={teamIds.length} icon={Users} />
        </div>

        <Card className={cn("mt-4", pending.length > 0 && "border-warning/30")}>
          <CardHeader title={`Solicitudes por decidir · ${pending.length}`} description="Antes de aprobar, mirá si coincide con alguien más del equipo." />
          <CardBody>
            {approvals.length ? (
              <Approvals orgId={orgId} requests={approvals} holidays={holidayList} />
            ) : (
              <EmptyState
                icon={CalendarCheck2}
                title="Nada por decidir"
                description="Cuando alguien de tu equipo pida días, te llega un aviso y la solicitud aparece acá."
              />
            )}
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader
            title="Calendario del equipo"
            description="Ausencias aprobadas y pendientes, día por día"
            action={<MonthNav month={month} basePath={base} query={{ tab: "equipo" }} />}
          />
          <CardBody>
            <TeamCalendar orgId={orgId} days={days} rows={calendarRows} today={today} />
          </CardBody>
        </Card>

        {upcoming.length > 0 ? (
          <Card className="mt-4">
            <CardHeader title="Próximas ausencias" />
            <CardBody>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <Avatar name={nameOf(r.membership_id)} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{nameOf(r.membership_id)}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {new Date(`${r.start_date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        {" · "}
                        {businessDays(r, holidays)} días
                        {r.kind !== "vacation" ? ` · ${ABSENCE_LABEL[r.kind]}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </>
    );
  }

  // ── Pestaña "Mis vacaciones" ─────────────────────────────
  const mine = requests.filter((r) => r.membership_id === me.id);
  const balance = vacationBalance(me.annual_vacation_days, mine, year, holidays);
  // Quién decide mis solicitudes (misma regla que la base: primer responsable con permiso, o administración)
  const approvedBy = joinNames(naturalApprovers(employees, me.id, roleCan("vacations.approve"), roleCan("employees.manage")).map(nameOf));

  return (
    <>
      <PageHeader
        eyebrow={`Año ${year}`}
        title="Vacaciones"
        description="Solicitá días libres y seguí el estado de tus pedidos. El saldo se calcula en días hábiles."
      />
      {tabs}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Disponibles" value={balance.available} format="days" icon={Palmtree} tone="success" />
        <StatCard index={1} label="Usados" value={balance.used} format="days" icon={CalendarCheck2} />
        <StatCard index={2} label="Pendientes" value={balance.pending} format="days" icon={CalendarClock} tone={balance.pending ? "warning" : undefined} />
        <StatCard index={3} label="Asignados" value={balance.allowance} format="days" icon={CalendarDays} hint="Por año calendario" />
      </div>

      {isApprover && pending.length > 0 ? (
        <Link
          href={`${base}?tab=equipo&month=${toMonthParam(monthStart(today))}`}
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-3.5 text-[13.5px] transition-colors hover:bg-warning/15"
        >
          <span>
            Tenés <strong>{pending.length}</strong> {pending.length === 1 ? "solicitud" : "solicitudes"} de tu equipo por decidir
          </span>
          <span className="font-medium">Ir a Equipo →</span>
        </Link>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader
            title="Nueva solicitud"
            description={approvedBy ? `La aprueba ${approvedBy}. Le llega un aviso.` : "No hay nadie asignado para aprobarla: avisá a administración."}
          />
          <CardBody>
            <RequestForm orgId={orgId} available={balance.available} holidays={holidayList} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mis solicitudes" />
          <CardBody className="pt-2">
            {mine.length ? (
              <MyRequests orgId={orgId} requests={mine} holidays={holidayList} />
            ) : (
              <EmptyState icon={Palmtree} title="Todavía no pediste vacaciones" description="Cuando lo hagas, vas a ver acá su estado." />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
