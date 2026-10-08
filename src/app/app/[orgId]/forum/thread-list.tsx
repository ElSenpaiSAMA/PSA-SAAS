"use client";

import Link from "next/link";
import { CheckCircle2, Lock, MessageSquare, MessagesSquare, Pin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { TimeAgo } from "@/components/ui/time-ago";
import { excerpt, FORUM_CATEGORIES, filterThreads, type ThreadStatusFilter } from "@/lib/domain/forum";
import type { ForumCategory } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { CategoryBadge } from "./category-badge";

export interface ThreadItem {
  id: string;
  category: ForumCategory;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  resolved: boolean;
  reply_count: number;
  created_at: string;
  last_activity_at: string;
  author: string;
  authorAvatar: string | null;
  /** Actividad de otra persona desde mi última visita */
  unread: boolean;
}

const STATUS: { value: ThreadStatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Sin resolver" },
  { value: "resolved", label: "Resueltos" },
];

const chip = (active: boolean) =>
  cn(
    "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
    active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
  );

export function ThreadList({ threads }: { threads: ThreadItem[] }) {
  // Las novedades se fijan al abrir la página: al marcar el foro como visto, la lista se
  // vuelve a pedir, pero las marcas de "Nuevo" se mantienen mientras la persona está acá
  const [unread] = useState(() => new Set(threads.filter((t) => t.unread).map((t) => t.id)));
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [status, setStatus] = useState<ThreadStatusFilter>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterThreads(threads, { category, status, query }), [threads, category, status, query]);

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="Todavía no hay hilos"
        description="Abrí el primero: una duda, una incidencia en un barco o un aviso para todo el equipo."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categoría">
          <button type="button" className={chip(category === null)} onClick={() => setCategory(null)}>
            Todas
          </button>
          {FORUM_CATEGORIES.map((c) => (
            <button key={c.value} type="button" className={chip(category === c.value)} onClick={() => setCategory(c.value)}>
              {c.label}
            </button>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-border sm:block" />
          {STATUS.map((s) => (
            <button key={s.value} type="button" className={chip(status === s.value)} onClick={() => setStatus(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="relative block lg:w-72">
          <span className="sr-only">Buscar en el foro</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: plotter, sellador…" className="pl-9" />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Search} title="Nada coincide con los filtros" description="Probá con otra categoría o con otras palabras." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card" aria-label="Hilos del foro">
          {visible.map((t) => (
            <li key={t.id}>
              <Link href={`/app/forum/${t.id}`} className="group flex gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                <Avatar name={t.author} src={t.authorAvatar} size={36} className="mt-0.5 hidden sm:inline-flex" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {unread.has(t.id) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                        Nuevo
                      </span>
                    ) : null}
                    {t.pinned ? <Pin className="size-3.5 text-accent" aria-label="Fijado" /> : null}
                    <CategoryBadge category={t.category} />
                    {t.resolved ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
                        <CheckCircle2 className="size-3.5" /> Resuelto
                      </span>
                    ) : null}
                    {t.locked ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                        <Lock className="size-3.5" /> Cerrado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 truncate text-[15px] font-semibold tracking-tight group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">
                    {t.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{excerpt(t.body)}</p>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">{t.author}</span> · <TimeAgo iso={t.created_at} />
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-[12.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 tabular" aria-label={`${t.reply_count} respuestas`}>
                    <MessageSquare className="size-3.5" />
                    {t.reply_count}
                  </span>
                  {t.reply_count > 0 ? (
                    <span className="hidden sm:inline">
                      últ. <TimeAgo iso={t.last_activity_at} />
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
