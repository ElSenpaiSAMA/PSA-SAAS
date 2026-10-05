"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Clock3, FolderKanban, KeyRound, ScrollText, Users, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { auditCategory, changedFields, describeAudit, relativeTime, type AuditCategory } from "@/lib/domain/audit";
import { useNow } from "@/lib/use-now";
import type { AuditLog } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const CATEGORIES: { id: AuditCategory | "all"; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "Todo", icon: ScrollText },
  { id: "people", label: "Personas", icon: Users },
  { id: "time", label: "Fichaje", icon: Clock3 },
  { id: "vacations", label: "Vacaciones", icon: CalendarDays },
  { id: "projects", label: "Proyectos", icon: FolderKanban },
  { id: "auth", label: "Accesos", icon: KeyRound },
];

export function AuditFeed({ entries, names }: { entries: AuditLog[]; names: Record<string, string> }) {
  // Tiempo relativo y fecha local solo tras hidratar (servidor en UTC, cliente en hora local)
  const now = useNow();
  const [filter, setFilter] = useState<AuditCategory | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) {
      const cat = auditCategory(e);
      c[cat] = (c[cat] ?? 0) + 1;
    }
    return c;
  }, [entries]);

  const visible = filter === "all" ? entries : entries.filter((e) => auditCategory(e) === filter);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por categoría">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-all",
              filter === c.id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <c.icon className="size-3.5" strokeWidth={1.75} />
            {c.label}
            <span className="tabular opacity-60">{counts[c.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ScrollText} title="Sin eventos en esta categoría" />
      ) : (
        <ol className="relative grid gap-1 before:absolute before:top-2 before:bottom-2 before:left-[19px] before:w-px before:bg-border">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((e, i) => {
              const who = e.user_id ? (names[e.user_id] ?? "Usuario eliminado") : "Sistema";
              const fields = changedFields(e);
              const open = expanded === e.id;
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}
                  exit={{ opacity: 0 }}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : e.id)}
                    disabled={fields.length === 0}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors enabled:hover:bg-muted/60"
                  >
                    <Avatar name={who} size={30} className="relative z-10 ml-1" />
                    <p className="min-w-0 flex-1 truncate text-[13.5px]">
                      <span className="font-medium">{who}</span> <span className="text-muted-foreground">{describeAudit(e)}</span>
                    </p>
                    {fields.length ? (
                      <span className="hidden rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">
                        {fields.length} {fields.length === 1 ? "cambio" : "cambios"}
                      </span>
                    ) : null}
                    <time
                      dateTime={e.created_at}
                      className="min-w-16 shrink-0 text-right text-[12px] text-muted-foreground"
                      title={now === null ? undefined : new Date(e.created_at).toLocaleString("es-ES")}
                    >
                      {now === null ? " " : relativeTime(e.created_at, now)}
                    </time>
                  </button>
                  <AnimatePresence>
                    {open ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <dl className="mb-2 ml-12 grid gap-1 rounded-xl border border-border bg-card p-3 font-mono text-[12px]">
                          {fields.map((f) => (
                            <div key={f} className="grid grid-cols-[120px_1fr] gap-3">
                              <dt className="text-muted-foreground">{f}</dt>
                              <dd className="truncate">
                                <span className="text-danger line-through decoration-danger/40">{JSON.stringify(e.old_data?.[f])}</span>
                                {" → "}
                                <span className="text-success">{JSON.stringify(e.new_data?.[f])}</span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
