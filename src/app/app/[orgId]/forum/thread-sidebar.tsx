import Link from "next/link";
import { CheckCircle2, Clock3, Lock, MessageSquare, Pin } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { TimeAgo } from "@/components/ui/time-ago";
import { CATEGORY_LABEL, type Participant } from "@/lib/domain/forum";
import type { ForumCategory } from "@/lib/supabase/database.types";
import { CategoryBadge } from "./category-badge";

export interface SidebarThread {
  category: ForumCategory;
  pinned: boolean;
  locked: boolean;
  resolved: boolean;
  created_at: string;
  last_activity_at: string;
  replies: number;
}

export interface RelatedThread {
  id: string;
  title: string;
  category: ForumCategory;
  reply_count: number;
  last_activity_at: string;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-4 first:border-t-0">
      <h2 className="mb-3 text-[12px] font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** "Sobre este hilo": estado, fechas, quiénes participan y otros hilos para seguir leyendo. */
export function ThreadSidebar({
  thread,
  participants,
  related,
}: {
  thread: SidebarThread;
  participants: Participant[];
  related: RelatedThread[];
}) {
  const sameCategory = related.length > 0 && related.every((t) => t.category === thread.category);
  const relatedTitle = sameCategory
    ? `Más ${thread.category === "notice" ? "avisos" : thread.category === "question" ? "dudas" : "incidencias"}`
    : "Otros hilos";

  return (
    <aside aria-label="Sobre este hilo" className="overflow-hidden rounded-2xl border border-border bg-card">
      <Section title="Sobre este hilo">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={thread.category} />
          {thread.pinned ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-accent">
              <Pin className="size-3.5" /> Fijado
            </span>
          ) : null}
          {thread.resolved ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
              <CheckCircle2 className="size-3.5" /> Resuelto
            </span>
          ) : null}
          {thread.locked ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
              <Lock className="size-3.5" /> Cerrado
            </span>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Creado</dt>
            <dd>
              <TimeAgo iso={thread.created_at} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Última actividad</dt>
            <dd>
              <TimeAgo iso={thread.last_activity_at} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Respuestas</dt>
            <dd className="tabular-nums">{thread.replies}</dd>
          </div>
        </dl>
      </Section>

      <Section title={`Participan (${participants.length})`}>
        {participants.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nadie todavía.</p>
        ) : (
          <ul className="grid gap-2.5">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
                <Avatar name={p.name} src={p.avatar} size={26} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.isAuthor ? (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Autor</span>
                ) : null}
                {p.replies > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-[12px] text-muted-foreground tabular-nums"
                    title={`${p.replies} ${p.replies === 1 ? "respuesta" : "respuestas"}`}
                  >
                    <MessageSquare className="size-3" /> {p.replies}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {related.length > 0 ? (
        <Section title={relatedTitle}>
          <ul className="-mx-2 grid gap-0.5">
            {related.map((t) => (
              <li key={t.id}>
                <Link href={`/app/forum/${t.id}`} className="block rounded-lg px-2 py-2 transition-colors hover:bg-muted">
                  <span className="line-clamp-2 text-[13px] leading-snug font-medium">{t.title}</span>
                  <span className="mt-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    {sameCategory ? null : <span>{CATEGORY_LABEL[t.category]}</span>}
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3" /> {t.reply_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" /> <TimeAgo iso={t.last_activity_at} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </aside>
  );
}
