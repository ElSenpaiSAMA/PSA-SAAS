import type { Metadata } from "next";
import { CalendarCheck2, CalendarClock, CalendarDays, Palmtree } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getEmployees } from "@/lib/data/employees";
import { getOrgContext } from "@/lib/data/session";
import { getVisibleVacationRequests } from "@/lib/data/vacations";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { businessDays, vacationBalance } from "@/lib/domain/vacations";
import { Approvals, MyRequests, type PendingApproval } from "./request-list";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Vacaciones" };

export default async function VacationsPage({ params }: PageProps<"/app/[orgId]/vacations">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership;
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const employees = await getEmployees(orgId);
  const supervised = ctx.can("vacations.approve")
    ? supervisedIds(employees, me.id, ctx.can("employees.manage"))
    : new Set<string>();

  const requests = await getVisibleVacationRequests([me.id, ...supervised]);
  const mine = requests.filter((r) => r.membership_id === me.id);
  const balance = vacationBalance(me.annual_vacation_days, mine, year);

  const byId = new Map(employees.map((e) => [e.id, e]));
  const pending: PendingApproval[] = requests
    .filter((r) => r.status === "pending" && supervised.has(r.membership_id))
    .map((r) => {
      const emp = byId.get(r.membership_id);
      const own = requests.filter((x) => x.membership_id === r.membership_id);
      return {
        ...r,
        name: displayName(emp?.profile ?? null),
        position: emp?.position ?? null,
        available: vacationBalance(emp?.annual_vacation_days ?? 0, own, year).available,
      };
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const upcoming = requests
    .filter((r) => r.status === "approved" && r.end_date >= today && r.membership_id !== me.id)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow={`Año ${year}`}
        title="Vacaciones"
        description="Solicitá días libres y seguí el estado de tus pedidos. El saldo se calcula en días hábiles."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Disponibles" value={balance.available} format="days" icon={Palmtree} tone="success" />
        <StatCard index={1} label="Usados" value={balance.used} format="days" icon={CalendarCheck2} />
        <StatCard index={2} label="Pendientes" value={balance.pending} format="days" icon={CalendarClock} tone={balance.pending ? "warning" : undefined} />
        <StatCard index={3} label="Asignados" value={balance.allowance} format="days" icon={CalendarDays} hint="Por año calendario" />
      </div>

      {pending.length > 0 ? (
        <Card className="mt-4 border-warning/30">
          <CardHeader
            title={`Por aprobar · ${pending.length}`}
            description="Solicitudes de tu equipo esperando tu decisión"
          />
          <CardBody>
            <Approvals orgId={orgId} requests={pending} />
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader title="Nueva solicitud" description="Llega a tu manager para aprobar" />
          <CardBody>
            <RequestForm orgId={orgId} available={balance.available} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mis solicitudes" />
          <CardBody className="pt-2">
            {mine.length ? (
              <MyRequests orgId={orgId} requests={mine} />
            ) : (
              <EmptyState icon={Palmtree} title="Todavía no pediste vacaciones" description="Cuando lo hagas, vas a ver acá su estado." />
            )}
          </CardBody>
        </Card>
      </div>

      {upcoming.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Próximas ausencias del equipo" />
          <CardBody>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((r) => {
                const emp = byId.get(r.membership_id);
                const name = displayName(emp?.profile ?? null);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <Avatar name={name} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{name}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {new Date(`${r.start_date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        {" · "}
                        {businessDays(r)} días
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
