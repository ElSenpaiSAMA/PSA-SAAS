import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock3, FolderKanban, History, Lock, Palmtree, ScrollText, SquareCheckBig } from "lucide-react";
import { MonthNav } from "@/components/app/month-nav";
import { StatCard } from "@/components/app/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getHolidaySet } from "@/lib/data/calendar";
import { getDepartments } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getEmployeeRecords, getMemberAudit, getMemberEntries, getMemberVacations } from "@/lib/data/employee-profile";
import { getProjectMembers, getProjects, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { describeAudit, foldClockSegments, groupConsecutive } from "@/lib/domain/audit";
import {
  changedInRange,
  FIELD_GROUPS,
  FIELD_LABEL,
  formatFieldValue,
  maskIban,
  recordAt,
  recordTimeline,
  seniorityYears,
  upcomingVersions,
} from "@/lib/domain/employee-records";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { isRole, ROLE_LABEL } from "@/lib/domain/permissions";
import { workingDays } from "@/lib/domain/planning";
import { addMonths, formatMonth, formatRange, monthEnd, monthStart, overlaps, parseMonthParam, todayISO } from "@/lib/domain/periods";
import { formatMinutes, periodActivity } from "@/lib/domain/time";
import { businessDays, vacationBalance } from "@/lib/domain/vacations";
import { cn } from "@/lib/utils";
import { RecordForm } from "./record-form";

export const metadata: Metadata = { title: "Perfil de empleado" };

const TASK_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  todo: { label: "Por hacer", tone: "neutral" },
  in_progress: { label: "En curso", tone: "accent" },
  done: { label: "Hecha", tone: "success" },
};
const VACATION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  approved: { label: "Aprobada", tone: "success" },
  rejected: { label: "Rechazada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

const fmtDay = (iso: string) => formatFieldValue("hire_date", iso);

/** Inicio del día local (servidor) en ISO, para filtrar timestamps por mes. */
const isoAt = (date: string) => new Date(`${date}T00:00:00`).toISOString();

export default async function EmployeeProfilePage({ params, searchParams }: PageProps<"/app/[orgId]/staff/[membershipId]">) {
  const { orgId, membershipId } = await params;
  const { month: monthParam } = await searchParams;
  const ctx = await getOrgContext(orgId);
  const today = todayISO();
  const currentMonth = monthStart(today);
  const month = parseMonthParam(monthParam) ?? currentMonth;
  const from = month;
  const to = monthEnd(month);
  const isCurrent = month === currentMonth;
  // La ficha se muestra como estaba al final del mes (o hoy, si es el mes en curso)
  const asOf = isCurrent ? today : to;

  const employees = await getEmployees(orgId);
  const person = employees.find((e) => e.id === membershipId);
  if (!person) notFound();

  const isMe = person.id === ctx.membership.id;
  const canSeeWork =
    isMe || (ctx.can("time.view_team") && supervisedIds(employees, ctx.membership.id, ctx.can("employees.manage")).has(person.id));
  const canEditRecord = ctx.can("people.sensitive");
  const canSeeRecord = isMe || canEditRecord;
  const canSeeAudit = ctx.can("employees.manage");

  const [departments, projects, members, tasks, records, entries, vacations, holidays] = await Promise.all([
    getDepartments(orgId),
    getProjects(orgId),
    getProjectMembers(orgId),
    getTasks(orgId),
    canSeeRecord ? getEmployeeRecords(person.id) : Promise.resolve([]),
    canSeeWork ? getMemberEntries(person.id, isoAt(from), isoAt(addMonths(from, 1))) : Promise.resolve([]),
    canSeeWork ? getMemberVacations(person.id) : Promise.resolve([]),
    getHolidaySet(orgId, `${month.slice(0, 4)}-01-01`, `${month.slice(0, 4)}-12-31`),
  ]);
  const audit = canSeeAudit
    ? groupConsecutive(
        foldClockSegments(
          await getMemberAudit(
            orgId,
            {
              userId: person.user_id,
              membershipId: person.id,
              recordIds: records.map((r) => r.id),
            },
            isoAt(from),
            isoAt(addMonths(from, 1)),
          ),
        ),
      ).slice(0, 15)
    : [];

  const name = displayName(person.profile);
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
  const nameByUser = new Map(employees.map((e) => [e.user_id, displayName(e.profile)]));
  const department = departments.find((d) => d.id === person.department_id);
  const headOf = departments.filter((d) => d.head_id === person.id);
  const manager = person.manager_id ? employees.find((e) => e.id === person.manager_id) : undefined;
  const reports = employees.filter((e) => e.manager_id === person.id && e.status === "active");

  // ── Ficha a la fecha ──
  const record = recordAt(records, asOf);
  const changed = changedInRange(records, from, to);
  const upcoming = isCurrent ? upcomingVersions(records, today) : [];
  const timeline = recordTimeline(records);
  const seniority = seniorityYears(record?.hire_date ?? null, asOf);

  // ── Trabajo del mes ──
  const activity = periodActivity(entries);
  const capacityMinutes = Math.round((workingDays(from, to, holidays).length * person.weekly_hours * 60) / 5);
  const myProjects = projects.filter((p) => members.some((m) => m.project_id === p.id && m.membership_id === person.id));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const monthTasks = tasks
    .filter((t) => t.assigned_to === person.id)
    .filter((t) =>
      t.start_date || t.due_date
        ? overlaps(t.start_date ?? t.due_date!, t.due_date ?? t.start_date!, from, to)
        : activity.byTask.has(t.id) || (isCurrent && t.status !== "done"),
    )
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  // ── Vacaciones ──
  const year = Number(month.slice(0, 4));
  const balance = vacationBalance(person.annual_vacation_days, vacations, year, holidays);
  const yearRequests = vacations.filter((v) => v.start_date.startsWith(`${year}-`) || v.end_date.startsWith(`${year}-`));
  const monthOff = vacations
    .filter((v) => v.status === "approved" && overlaps(v.start_date, v.end_date, from, to))
    .reduce(
      (s, v) =>
        s +
        businessDays(
          {
            start_date: v.start_date < from ? from : v.start_date,
            end_date: v.end_date > to ? to : v.end_date,
          },
          holidays,
        ),
      0,
    );

  const base = `/app/${orgId}/staff/${person.id}`;
  const roleLabel = isRole(person.role_id) ? ROLE_LABEL[person.role_id] : person.role_id;

  return (
    <>
      <Link
        href={`/app/${orgId}/staff`}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Empleados
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar name={name} size={64} />
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-[28px] leading-tight font-semibold tracking-tight">
              {name}
              {person.status === "inactive" ? <Badge tone="neutral">Baja</Badge> : null}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {[person.position, department?.name, roleLabel].filter(Boolean).join(" · ")}
            </p>
            {person.profile?.email ? <p className="text-[12.5px] text-muted-foreground">{person.profile.email}</p> : null}
          </div>
        </div>
        <div className="grid justify-items-end gap-1.5">
          <MonthNav month={month} basePath={base} />
          <span className="text-[12px] text-muted-foreground">Navegá por meses para ver la ficha y la actividad de cada período</span>
        </div>
      </header>

      {!isCurrent ? (
        <p className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-2.5 text-[13px]">
          <History className="size-4 text-accent" />
          <span>
            Estás viendo <strong className="font-semibold">{formatMonth(month)}</strong>: la ficha muestra cómo estaba al {fmtDay(to)}.
          </span>
          <Link href={base} className="ml-auto font-medium text-accent hover:underline">
            Volver a hoy
          </Link>
        </p>
      ) : null}

      {canSeeWork ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            index={0}
            label="Horas fichadas"
            value={activity.clockMinutes}
            format="minutes"
            icon={Clock3}
            hint={`${activity.daysWorked} días · capacidad ${formatMinutes(capacityMinutes)}${activity.breakMinutes ? ` · ${formatMinutes(activity.breakMinutes)} de pausa` : ""}`}
          />
          <StatCard
            index={1}
            label="Imputadas a tareas"
            value={activity.taskMinutes}
            format="minutes"
            icon={SquareCheckBig}
            hint={`en ${activity.byTask.size} tareas`}
          />
          <StatCard
            index={2}
            label={`Vacaciones ${year}`}
            value={balance.available}
            icon={Palmtree}
            hint={`disponibles · ${balance.used} usados · ${balance.pending} pendientes${monthOff ? ` · ${monthOff} este mes` : ""}`}
          />
          <StatCard
            index={3}
            label="Proyectos"
            value={myProjects.length}
            icon={FolderKanban}
            hint={`${monthTasks.length} tareas en el mes`}
          />
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          Las horas y vacaciones de {name.split(" ")[0]} solo las ven la propia persona, su línea de reporte y administración.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Columna principal ── */}
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Proyectos y tareas" description={`Asignado en ${formatMonth(month)}`} />
            <CardBody className="grid gap-4">
              {myProjects.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {myProjects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/app/${orgId}/projects/${p.id}`}
                      className="inline-flex h-7 items-center rounded-full border border-border px-3 text-[12.5px] transition-colors hover:border-border-strong"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">No es miembro de ningún proyecto visible para vos.</p>
              )}
              {monthTasks.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {monthTasks.map((t) => {
                    const st = TASK_STATUS[t.status] ?? TASK_STATUS.todo;
                    const logged = activity.byTask.get(t.id) ?? 0;
                    return (
                      <li
                        key={t.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium">{t.title}</p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {projectName.get(t.project_id)}
                            {t.start_date || t.due_date
                              ? ` · ${formatRange(t.start_date ?? t.due_date!, t.due_date ?? t.start_date!)}`
                              : ""}
                          </p>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <span className="hidden text-right text-[12.5px] text-muted-foreground tabular sm:block">
                          {canSeeWork ? (logged ? `${formatMinutes(logged)} este mes` : "sin horas este mes") : ""}
                        </span>
                        <span className="hidden text-right text-[12px] text-muted-foreground tabular sm:block">
                          {t.estimated_hours ? `est. ${Number(t.estimated_hours)} h` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">Sin tareas asignadas en {formatMonth(month)}.</p>
              )}
            </CardBody>
          </Card>

          {canSeeWork ? (
            <Card>
              <CardHeader
                title={`Vacaciones ${year}`}
                description={`${person.annual_vacation_days} días al año · festivos de la empresa excluidos`}
              />
              <CardBody>
                {yearRequests.length ? (
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {yearRequests.map((v) => {
                      const st = VACATION_STATUS[v.status] ?? VACATION_STATUS.pending;
                      const inMonth = overlaps(v.start_date, v.end_date, from, to);
                      return (
                        <li key={v.id} className={cn("flex items-center gap-3 px-4 py-3", inMonth && "bg-accent-soft/40")}>
                          <CalendarClock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1 text-[13.5px]">
                            {formatRange(v.start_date, v.end_date)}
                            <span className="text-muted-foreground"> · {businessDays(v, holidays)} días hábiles</span>
                            {v.reason && (isMe || canEditRecord) ? (
                              <span className="block truncate text-[12px] text-muted-foreground">{v.reason}</span>
                            ) : null}
                          </span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted-foreground">No pidió vacaciones en {year}.</p>
                )}
              </CardBody>
            </Card>
          ) : null}

          {canSeeAudit ? (
            <Card>
              <CardHeader title="Actividad" description={`Lo que hizo y lo que cambió sobre esta persona en ${formatMonth(month)}`} />
              <CardBody>
                {audit.length ? (
                  <ol className="grid gap-3">
                    {audit.map(({ entry: e, count }) => (
                      <li key={e.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-[13px]">
                        <time className="text-muted-foreground tabular" dateTime={e.created_at}>
                          {new Date(e.created_at).toLocaleString("es-ES", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Madrid",
                          })}
                        </time>
                        <span>
                          <span className="font-medium">{e.user_id ? (nameByUser.get(e.user_id) ?? "Alguien") : "Sistema"}</span>{" "}
                          <span className="text-muted-foreground">{describeAudit(e)}</span>
                          {count > 1 ? <span className="ml-1.5 text-[12px] text-muted-foreground tabular">×{count}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Sin actividad registrada en {formatMonth(month)}.</p>
                )}
                <Link
                  href={`/app/${orgId}/audit`}
                  className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
                >
                  <ScrollText className="size-3.5" /> Ver auditoría completa
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* ── Columna lateral ── */}
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Organización" />
            <CardBody>
              <dl className="grid gap-3 text-[13px]">
                <Row label="Departamento">
                  {department?.name ?? "—"}
                  {headOf.length ? (
                    <span className="text-muted-foreground"> · responsable de {headOf.map((d) => d.name).join(", ")}</span>
                  ) : null}
                </Row>
                <Row label="Reporta a">
                  {manager ? (
                    <Link
                      href={`/app/${orgId}/staff/${manager.id}?month=${month.slice(0, 7)}`}
                      className="hover:text-accent hover:underline"
                    >
                      {names.get(manager.id)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Row>
                <Row label="Personas a cargo">
                  {reports.length ? (
                    <span className="flex flex-wrap gap-x-2 gap-y-1">
                      {reports.map((r) => (
                        <Link
                          key={r.id}
                          href={`/app/${orgId}/staff/${r.id}?month=${month.slice(0, 7)}`}
                          className="hover:text-accent hover:underline"
                        >
                          {names.get(r.id)}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    "Nadie"
                  )}
                </Row>
                <Row label="Rol en la app">{roleLabel}</Row>
                <Row label="Jornada">{person.weekly_hours} h/semana</Row>
                <Row label="En la plataforma desde">{fmtDay(person.created_at.slice(0, 10))}</Row>
              </dl>
            </CardBody>
          </Card>

          {canSeeRecord ? (
            <Card>
              <CardHeader
                title="Ficha personal"
                description={
                  canEditRecord ? "Datos sensibles: solo administración y la propia persona" : "Solo vos y administración ven estos datos"
                }
              />
              <CardBody className="grid gap-5">
                {record ? (
                  <>
                    {FIELD_GROUPS.map((group) => (
                      <section key={group.title}>
                        <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
                        <dl className="grid gap-2 text-[13px]">
                          {group.fields.map((f) => (
                            <Row key={f} label={FIELD_LABEL[f]} highlight={changed.has(f)}>
                              {f === "iban" ? (maskIban(record.iban) ?? "—") : formatFieldValue(f, record[f])}
                              {f === "hire_date" && seniority !== null ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {seniority === 0 ? "menos de un año" : `${seniority} ${seniority === 1 ? "año" : "años"}`}
                                </span>
                              ) : null}
                            </Row>
                          ))}
                        </dl>
                      </section>
                    ))}
                    {changed.size ? (
                      <p className="text-[12px] text-muted-foreground">
                        <span className="mr-1.5 inline-block size-2 rounded-full bg-accent align-middle" />
                        Cambió en {formatMonth(month)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    {records.length ? `La ficha empieza después de ${formatMonth(month)}.` : "Todavía no hay datos cargados."}
                  </p>
                )}

                {upcoming.length ? (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-[12.5px]">
                    <p className="font-medium">Cambios programados</p>
                    {upcoming.map((u) => (
                      <p key={u.id} className="text-muted-foreground">
                        Desde el {fmtDay(u.effective_from)}:{" "}
                        {timeline
                          .find((t) => t.version.id === u.id)
                          ?.changes.map((c) => FIELD_LABEL[c.field])
                          .join(", ") || "sin cambios de datos"}
                      </p>
                    ))}
                  </div>
                ) : null}

                {canEditRecord ? (
                  <RecordForm
                    orgId={orgId}
                    membershipId={person.id}
                    today={today}
                    current={record ? Object.fromEntries(FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f, record[f]])) : null}
                  />
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {canSeeRecord && timeline.length ? (
            <Card>
              <CardHeader title="Historial de la ficha" description="Cada versión, desde cuándo rige y qué cambió" />
              <CardBody>
                <ol className="relative grid gap-4 border-l border-border pl-4">
                  {timeline.map(({ version, changes, isFirst }) => {
                    const future = version.effective_from > today;
                    const viewing = version.id === record?.id;
                    return (
                      <li key={version.id} className="relative">
                        <span
                          className={cn(
                            "absolute top-1 -left-[21px] size-2.5 rounded-full ring-4 ring-card",
                            future ? "bg-warning" : viewing ? "bg-accent" : "bg-border-strong",
                          )}
                        />
                        <Link
                          href={`${base}?month=${version.effective_from.slice(0, 7)}`}
                          className="text-[13px] font-medium tabular hover:text-accent hover:underline"
                        >
                          {fmtDay(version.effective_from)}
                        </Link>
                        {future ? (
                          <Badge tone="warning" className="ml-2">
                            Programado
                          </Badge>
                        ) : null}
                        {viewing ? (
                          <Badge tone="accent" className="ml-2">
                            Vigente en {isCurrent ? "hoy" : formatMonth(month)}
                          </Badge>
                        ) : null}
                        {version.notes ? <p className="text-[12.5px] text-muted-foreground">{version.notes}</p> : null}
                        <ul className="mt-1 grid gap-0.5 text-[12.5px]">
                          {isFirst ? (
                            <li className="text-muted-foreground">Alta de la ficha</li>
                          ) : changes.length ? (
                            changes.map((c) => (
                              <li key={c.field}>
                                <span className="text-muted-foreground">{FIELD_LABEL[c.field]}:</span>{" "}
                                {c.field === "iban" ? (
                                  "actualizado"
                                ) : (
                                  <>
                                    <span className="line-through decoration-muted-foreground/60">{formatFieldValue(c.field, c.from)}</span>{" "}
                                    → {formatFieldValue(c.field, c.to)}
                                  </>
                                )}
                              </li>
                            ))
                          ) : (
                            <li className="text-muted-foreground">Sin cambios de datos</li>
                          )}
                        </ul>
                      </li>
                    );
                  })}
                </ol>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({ label, highlight, children }: { label: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words", highlight && "relative font-medium text-accent")}>
        {highlight ? <span className="absolute top-1.5 -left-3 size-1.5 rounded-full bg-accent" aria-label="Cambió este mes" /> : null}
        {children}
      </dd>
    </div>
  );
}
