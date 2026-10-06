"use client";

import { AnimatePresence, motion } from "motion/react";
import { Clock3, Coffee, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/lib/use-now";
import { entryMinutes, formatMinutes, startOfDay } from "@/lib/domain/time";
import type { TimeEntryWithTask } from "@/lib/data/time";
import { deleteTaskEntry } from "./actions";
import { CorrectionForm } from "./correction-form";

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

export function EntriesList({
  orgId,
  entries,
  pendingEntryIds = [],
}: {
  orgId: string;
  entries: TimeEntryWithTask[];
  /** Tramos con una corrección ya pedida y pendiente */
  pendingEntryIds?: string[];
}) {
  const hydrated = useHydrated();
  // Qué formulario de corrección está abierto: un tramo, "new" (olvidado) o ninguno
  const [editing, setEditing] = useState<string | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const pendingSet = new Set(pendingEntryIds);
  const groups = useMemo(() => {
    const map = new Map<number, TimeEntryWithTask[]>();
    for (const e of entries) {
      const key = startOfDay(new Date(e.started_at)).getTime();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [entries]);

  const forgotten = hydrated ? (
    <div className="grid gap-3">
      {editing === "new" ? (
        <CorrectionForm orgId={orgId} onDone={close} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex h-9 items-center gap-1.5 justify-self-start rounded-xl border border-dashed border-border px-3 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Plus className="size-4" /> Agregar un fichaje olvidado
        </button>
      )}
    </div>
  ) : null;

  if (entries.length === 0) {
    return (
      <div className="grid gap-4">
        {forgotten}
        <EmptyState icon={Clock3} title="Sin registros todavía" description="Fichá tu entrada para empezar a llevar la cuenta." />
      </div>
    );
  }

  // Agrupar por día y mostrar horas depende de la zona horaria del navegador
  if (!hydrated) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {forgotten}
      {groups.map(([day, items]) => {
        const clock = items.filter((e) => e.entry_type === "clock");
        const total = clock.reduce((s, e) => s + entryMinutes(e), 0);
        const pauses = items.filter((e) => e.entry_type === "break").reduce((s, e) => s + entryMinutes(e), 0);
        return (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[13px] font-medium capitalize">{dayLabel(new Date(day))}</h3>
              <span className="text-[12px] text-muted-foreground tabular">
                {formatMinutes(total)} fichadas{pauses ? ` · ${formatMinutes(pauses)} de pausa` : ""}
              </span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              <AnimatePresence initial={false}>
                {items.map((e) => (
                  <Fragment key={e.id}>
                    <motion.li
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
                            : e.entry_type === "break"
                              ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning"
                              : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
                        }
                      >
                        {e.entry_type === "clock" ? (
                          <Clock3 className="size-4" strokeWidth={1.75} />
                        ) : e.entry_type === "break" ? (
                          <Coffee className="size-4" strokeWidth={1.75} />
                        ) : (
                          <FolderKanban className="size-4" strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {e.entry_type !== "task" ? (
                          <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
                            {e.entry_type === "break" ? "Pausa" : "Jornada"}{" "}
                            <span className="text-muted-foreground tabular">
                              {time(e.started_at)} — {e.ended_at ? time(e.ended_at) : "en curso"}
                            </span>
                            {pendingSet.has(e.id) ? <Badge tone="warning">Corrección pendiente</Badge> : null}
                          </p>
                        ) : (
                          <p className="truncate text-[13.5px]">
                            {e.task?.title ?? "Tarea eliminada"} <span className="text-muted-foreground">· {e.task?.project?.name}</span>
                          </p>
                        )}
                      </div>
                      <span className="text-[13px] font-medium tabular">
                        {e.ended_at ? (
                          formatMinutes(entryMinutes(e))
                        ) : (
                          <span className={e.entry_type === "break" ? "text-warning" : "text-success"}>En curso</span>
                        )}
                      </span>
                      {e.entry_type === "task" ? (
                        <DeleteButton orgId={orgId} id={e.id} />
                      ) : e.entry_type === "clock" && e.ended_at && !pendingSet.has(e.id) ? (
                        <button
                          type="button"
                          aria-label="Corregir fichaje"
                          title="Corregir este fichaje"
                          onClick={() => setEditing(editing === e.id ? null : e.id)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                        >
                          <Pencil className="size-4" strokeWidth={1.75} />
                        </button>
                      ) : (
                        <span className="size-8" />
                      )}
                    </motion.li>
                    {editing === e.id ? (
                      <li className="px-4 py-3">
                        <CorrectionForm orgId={orgId} entry={e} onDone={close} />
                      </li>
                    ) : null}
                  </Fragment>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
