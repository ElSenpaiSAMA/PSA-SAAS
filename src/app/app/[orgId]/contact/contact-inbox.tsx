"use client";

import Link from "next/link";
import { ArrowLeft, Check, Mail, MailOpen, Phone, RotateCcw, Sailboat, UserCheck, Wrench } from "lucide-react";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeTime } from "@/lib/domain/audit";
import { CONTACT_FILTERS, CONTACT_STATUS_LABEL, replyMailto, type ContactFilter } from "@/lib/domain/contact";
import { brand } from "@/lib/brand";
import type { ContactStatus } from "@/lib/supabase/database.types";
import { useHydrated, useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { setContactStatus } from "./actions";

export interface ContactItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  boatType: string;
  boatModel: string | null;
  service: string;
  message: string;
  status: ContactStatus;
  handler: string | null;
  handledAt: string | null;
  createdAt: string;
}

const TONE: Record<ContactStatus, BadgeTone> = { new: "accent", in_progress: "warning", closed: "neutral" };

const EMPTY: Record<ContactFilter, string> = {
  new: "No hay consultas nuevas. Cuando alguien escriba desde la web, aparece acá.",
  in_progress: "Ninguna consulta en curso.",
  closed: "Todavía no se cerró ninguna consulta.",
  all: "Cuando alguien escriba desde el formulario de contacto de la web, aparece acá.",
};

export function ContactInbox({
  orgId,
  filter,
  counts,
  items,
  selected,
  explicit,
}: {
  orgId: string;
  filter: ContactFilter;
  counts: Record<ContactFilter, number>;
  items: ContactItem[];
  selected: ContactItem | null;
  /** El mensaje se eligió a mano (en móvil se muestra el detalle en vez de la lista) */
  explicit: boolean;
}) {
  const base = `/app/${orgId}/contact`;
  const href = (f: ContactFilter, id?: string) => `${base}?estado=${f}${id ? `&id=${id}` : ""}`;

  return (
    <div className="grid overflow-hidden rounded-2xl border border-border bg-card lg:min-h-[34rem] lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
      <section aria-label="Consultas" className={cn("flex min-w-0 flex-col border-border lg:border-r", explicit && "hidden lg:flex")}>
        <nav aria-label="Filtrar por estado" className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {CONTACT_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href(f.key)}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                f.key === filter ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {f.label}
              <span className="text-[11.5px] tabular-nums text-muted-foreground">{counts[f.key]}</span>
            </Link>
          ))}
        </nav>
        {items.length === 0 ? (
          <EmptyState icon={MailOpen} title="Sin consultas" description={EMPTY[filter]} className="flex-1" />
        ) : (
          <MessageList items={items} selectedId={selected?.id} href={(id) => href(filter, id)} />
        )}
      </section>

      <section aria-label="Consulta" className={cn("min-w-0", !explicit && "hidden lg:block")}>
        {selected ? (
          <MessageDetail key={selected.id} orgId={orgId} message={selected} back={href(filter)} />
        ) : (
          <EmptyState icon={Mail} title="Elegí una consulta" description="El detalle aparece acá." className="h-full" />
        )}
      </section>
    </div>
  );
}

function MessageList({ items, selectedId, href }: { items: ContactItem[]; selectedId?: string; href: (id: string) => string }) {
  const now = useNow();
  return (
    <ul className="divide-y divide-border">
      {items.map((m) => {
        const active = m.id === selectedId;
        return (
          <li key={m.id}>
            <Link
              href={href(m.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/50",
                active && "bg-muted/70 hover:bg-muted/70",
              )}
            >
              {active ? <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden /> : null}
              <span className="flex items-baseline gap-2">
                {m.status === "new" ? <span className="size-2 shrink-0 self-center rounded-full bg-accent" aria-label="Nueva" /> : null}
                <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", m.status === "new" && "font-semibold")}>{m.name}</span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">{now ? relativeTime(m.createdAt, now) : ""}</span>
              </span>
              <span className="truncate text-[12.5px] text-foreground/80">
                {m.service} · {m.boatModel ?? m.boatType}
              </span>
              <span className="truncate text-[12.5px] text-muted-foreground">{m.message}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MessageDetail({ orgId, message: m, back }: { orgId: string; message: ContactItem; back: string }) {
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const when = (iso: string) =>
    hydrated
      ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";

  const move = (status: ContactStatus, done: string) =>
    start(async () => {
      const r = await setContactStatus(orgId, m.id, status);
      if (r.status === "error") toast.error(r.message);
      else toast.success(done);
    });

  return (
    <article className="flex h-full flex-col">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <Link
          href={back}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="size-3.5" /> Volver a la lista
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[18px] font-semibold tracking-tight">{m.name}</h2>
              <Badge tone={TONE[m.status]} dot>
                {CONTACT_STATUS_LABEL[m.status]}
              </Badge>
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Recibido {when(m.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {m.status === "new" ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => move("in_progress", "Consulta en curso")}>
                <UserCheck className="size-3.5" /> Me ocupo yo
              </Button>
            ) : null}
            {m.status !== "closed" ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => move("closed", "Consulta cerrada")}>
                <Check className="size-3.5" /> Cerrar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => move("in_progress", "Consulta reabierta")}>
                <RotateCcw className="size-3.5" /> Reabrir
              </Button>
            )}
          </div>
        </div>
      </header>

      <dl className="grid gap-px border-b border-border bg-border sm:grid-cols-2">
        <Detail icon={Mail} label="Email">
          <a href={`mailto:${m.email}`} className="break-all hover:underline">
            {m.email}
          </a>
        </Detail>
        <Detail icon={Phone} label="Teléfono">
          {m.phone ? (
            <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
              {m.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">No lo dejó</span>
          )}
        </Detail>
        <Detail icon={Sailboat} label="Barco">
          {m.boatType}
          {m.boatModel ? <span className="text-muted-foreground"> · {m.boatModel}</span> : null}
        </Detail>
        <Detail icon={Wrench} label="Servicio">
          {m.service}
        </Detail>
      </dl>

      <div className="flex-1 px-5 py-5 sm:px-6">
        <p className="text-[12px] font-medium text-muted-foreground">Mensaje</p>
        <p className="mt-2 max-w-prose text-[14.5px] leading-relaxed whitespace-pre-line">{m.message}</p>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
        <p className="text-[12.5px] text-muted-foreground">
          {m.handler
            ? `${m.status === "closed" ? "Cerrada" : "La gestiona"} ${m.handler} · ${when(m.handledAt ?? m.createdAt)}`
            : "Nadie la tomó todavía"}
        </p>
        <div className="flex items-center gap-2">
          {m.phone ? (
            <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`} className={buttonClasses("secondary", "sm")}>
              <Phone className="size-3.5" /> Llamar
            </a>
          ) : null}
          <a href={replyMailto(m, brand.name)} className={buttonClasses("primary", "sm")}>
            <Mail className="size-3.5" /> Responder por email
          </a>
        </div>
      </footer>
    </article>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-card px-5 py-3 sm:px-6">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
        <dd className="text-[13.5px]">{children}</dd>
      </div>
    </div>
  );
}
