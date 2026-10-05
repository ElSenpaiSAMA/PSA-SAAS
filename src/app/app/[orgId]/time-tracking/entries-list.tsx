"use client";

import { AnimatePresence, motion } from "motion/react";
import { Clock3, FolderKanban, Trash2 } from "lucide-react";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { entryMinutes, formatMinutes, startOfDay } from "@/lib/domain/time";
import type { TimeEntryWithTask } from "@/lib/data/time";
import { deleteTaskEntry } from "./actions";

const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

function dayLabel(d: Date) {
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function DeleteButton({ orgId, id }: { orgId: string; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Eliminar registro"
      onClick={() =>
        start(async () => {
          const r = await deleteTaskEntry(orgId, id);
          if (r.status === "error") toast.error(r.message);
          else toast.success(r.message);
        })
      }
      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 disabled:opacity-50"
    >
      <Trash2 className="size-4" strokeWidth={1.75} />
    </button>
  );
}

export function EntriesList({ orgId, entries }: { orgId: string; entries: TimeEntryWithTask[] }) {
  const groups = useMemo(() => {
    const map = new Map<number, TimeEntryWithTask[]>();
    for (const e of entries) {
      const key = startOfDay(new Date(e.started_at)).getTime();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [entries]);

  if (entries.length === 0) {
    return <EmptyState icon={Clock3} title="Sin registros todavía" description="Fichá tu entrada para empezar a llevar la cuenta." />;
  }

  return (
    <div className="grid gap-6">
      {groups.map(([day, items]) => {
        const clock = items.filter((e) => e.entry_type === "clock");
        const total = clock.reduce((s, e) => s + entryMinutes(e), 0);
        return (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[13px] font-medium capitalize">{dayLabel(new Date(day))}</h3>
              <span className="text-[12px] text-muted-foreground tabular">{formatMinutes(total)} fichadas</span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              <AnimatePresence initial={false}>
                {items.map((e) => (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group flex items-center gap-3 px-4 py-3"
                  >
                    <div
                      className={
                        e.entry_type === "clock"
                          ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"
                          : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
                      }
                    >
                      {e.entry_type === "clock" ? (
                        <Clock3 className="size-4" strokeWidth={1.75} />
                      ) : (
                        <FolderKanban className="size-4" strokeWidth={1.75} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {e.entry_type === "clock" ? (
                        <p className="text-[13.5px]">
                          Jornada <span className="text-muted-foreground tabular">{time(e.started_at)} — {e.ended_at ? time(e.ended_at) : "en curso"}</span>
                        </p>
                      ) : (
                        <p className="truncate text-[13.5px]">
                          {e.task?.title ?? "Tarea eliminada"}{" "}
                          <span className="text-muted-foreground">· {e.task?.project?.name}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-[13px] font-medium tabular">
                      {e.ended_at ? formatMinutes(entryMinutes(e)) : <span className="text-success">En curso</span>}
                    </span>
                    {e.entry_type === "task" ? <DeleteButton orgId={orgId} id={e.id} /> : <span className="size-8" />}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
