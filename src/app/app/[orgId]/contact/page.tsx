import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { buttonClasses } from "@/components/ui/button";
import { getContactMessages } from "@/lib/data/contact";
import { requirePermission } from "@/lib/data/session";
import { countByFilter, defaultFilter, isContactFilter } from "@/lib/domain/contact";
import { ContactInbox, type ContactItem } from "./contact-inbox";

export const metadata: Metadata = { title: "Mensajes web" };

export default async function ContactPage({ params, searchParams }: PageProps<"/app/[orgId]/contact">) {
  const { orgId } = await params;
  const { estado, id } = await searchParams;
  await requirePermission(orgId, "contact.manage");
  const messages = await getContactMessages(orgId);

  const counts = countByFilter(messages);
  const filter = isContactFilter(estado) ? estado : defaultFilter(counts);
  const visible = filter === "all" ? messages : messages.filter((m) => m.status === filter);
  // Un mensaje elegido por enlace (p. ej. desde la notificación) se muestra aunque no sea de la pestaña
  const requested = typeof id === "string" ? messages.find((m) => m.id === id) : undefined;
  const selected = requested ?? visible[0];

  // Solo datos serializables al cliente
  const toItem = (m: (typeof messages)[number]): ContactItem => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    boatType: m.boat_type,
    boatModel: m.boat_model,
    service: m.service,
    message: m.message,
    status: m.status,
    handler: m.handler,
    handledAt: m.handled_at,
    createdAt: m.created_at,
  });

  return (
    <>
      <PageHeader
        title="Mensajes"
        accent="de la web"
        description="Las consultas que llegan desde el formulario de contacto de diplonautic.com."
        actions={
          <Link href="/contacto" target="_blank" className={buttonClasses("secondary")}>
            <ExternalLink className="size-4" />
            Ver formulario
          </Link>
        }
      />
      <ContactInbox
        orgId={orgId}
        filter={filter}
        counts={counts}
        items={visible.map(toItem)}
        selected={selected ? toItem(selected) : null}
        explicit={Boolean(requested)}
      />
    </>
  );
}
