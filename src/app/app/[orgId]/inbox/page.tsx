import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { getNotifications, getPending } from "@/lib/data/inbox";
import { getOrgContext } from "@/lib/data/session";
import { NotificationList } from "./notification-list";
import { PendingList } from "./pending-list";

export const metadata: Metadata = { title: "Bandeja" };

export default async function InboxPage({ params }: PageProps<"/app/[orgId]/inbox">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const [pending, notifications] = await Promise.all([getPending(orgId), getNotifications(ctx.membership.id)]);
  const urgent = pending.filter((p) => p.urgent).length;

  return (
    <>
      <PageHeader title="Bandeja" description="Lo que espera una acción tuya y los avisos de lo que pasa en tu equipo." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="pendientes">
          <h2 id="pendientes" className="mb-3 flex items-baseline gap-2 text-[15px] font-semibold tracking-tight">
            Pendientes
            <span className="text-[12.5px] font-normal text-muted-foreground">
              {pending.length ? `${pending.length}${urgent ? ` · ${urgent} ${urgent === 1 ? "urgente" : "urgentes"}` : ""}` : "al día"}
            </span>
          </h2>
          <PendingList items={pending} />
        </section>
        <section aria-labelledby="notificaciones">
          <h2 id="notificaciones" className="mb-3 text-[15px] font-semibold tracking-tight">
            Notificaciones
          </h2>
          <NotificationList orgId={orgId} items={notifications} />
        </section>
      </div>
    </>
  );
}
