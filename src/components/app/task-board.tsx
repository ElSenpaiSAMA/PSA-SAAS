"use client";

import { LayoutGroup, motion } from "motion/react";
import { CalendarClock, ChevronLeft, ChevronRight, Copy, Lock } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { updateTaskStatus } from "@/app/app/[orgId]/projects/actions";
import { duplicateTask } from "@/app/app/[orgId]/work-orders/actions";
import { formatRange, todayISO } from "@/lib/domain/periods";
import type { TaskStatus } from "@/lib/supabase/database.types";
import { useHydrated } from "@/lib/use-now";
import { cn } from "@/lib/utils";

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "todo", label: "Por hacer", dot: "bg-border-strong" },
  { status: "in_progress", label: "En curso", dot: "bg-accent" },
  { status: "done", label: "Hecho", dot: "bg-success" },
];

export interface BoardTask {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeName: string | null;
  estimatedHours: number | null;
  loggedHours: number;
  startDate: string | null;
  dueDate: string | null;
  canEdit: boolean;
  canDuplicate: boolean;
  mine: boolean;
}

function DueDate({ task }: { task: BoardTask }) {
  const hydrated = useHydrated();
  if (!task.dueDate) return null;
  // "Hoy" depende de la zona horaria del navegador: el aviso de vencida se calcula tras hidratar
  const overdue = hydrated && task.status !== "done" && task.dueDate < todayISO();
  return (
    <span
      className={cn(
        "mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px]",
        overdue ? "bg-danger/10 font-medium text-danger" : "bg-muted text-muted-foreground",
      )}
    >
      <CalendarClock className="size-3" strokeWidth={1.75} />
      {task.startDate ? formatRange(task.startDate, task.dueDate) : formatRange(task.dueDate, task.dueDate)}
      {overdue ? " · vencida" : ""}
    </span>
  );
}

export function TaskBoard({ orgId, tasks }: { orgId: string; tasks: BoardTask[] }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, move: { id: string; status: TaskStatus }) =>
    state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [, startTransition] = useTransition();
  const [duplicating, startDuplicate] = useTransition();

  const move = (task: BoardTask, dir: -1 | 1) => {
    const index = COLUMNS.findIndex((c) => c.status === task.status) + dir;
    const target = COLUMNS[index];
    if (!target) return;
    startTransition(async () => {
      setOptimistic({ id: task.id, status: target.status });
      const r = await updateTaskStatus(orgId, task.id, target.status);
      if (r.status === "error") toast.error(r.message);
    });
  };

  const duplicate = (task: BoardTask) =>
    startDuplicate(async () => {
      const r = await duplicateTask(orgId, task.id);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message, { description: task.title });
    });

  return (
    <LayoutGroup>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col, ci) => {
          const items = optimistic.filter((t) => t.status === col.status);
          return (
            <section key={col.status} className="rounded-2xl border border-border bg-muted/40 p-3">
              <header className="mb-3 flex items-center gap-2 px-1.5 pt-1">
                <span className={cn("size-2 rounded-full", col.dot)} />
                <h3 className="text-[13px] font-medium">{col.label}</h3>
                <span className="ml-auto text-[12px] text-muted-foreground tabular">{items.length}</span>
              </header>
              <div className="grid min-h-24 gap-2">
                {items.map((t) => {
                  const over = t.estimatedHours ? t.loggedHours > t.estimatedHours : false;
                  return (
                    <motion.article
                      key={t.id}
                      layoutId={t.id}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      className={cn(
                        "group rounded-xl border bg-card p-3.5 shadow-[0_1px_2px_0_rgb(0_0_0/0.04)]",
                        t.mine ? "border-accent/30" : "border-border",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <p
                          className={cn(
                            "flex-1 text-[13.5px] leading-snug font-medium",
                            t.status === "done" && "text-muted-foreground line-through decoration-border-strong",
                          )}
                        >
                          {t.title}
                        </p>
                        {t.canDuplicate ? (
                          <button
                            type="button"
                            onClick={() => duplicate(t)}
                            disabled={duplicating}
                            aria-label={`Duplicar "${t.title}"`}
                            title="Duplicar tarea"
                            className="-mt-1 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 disabled:opacity-40"
                          >
                            <Copy className="size-3.5" strokeWidth={1.75} />
                          </button>
                        ) : null}
                      </div>
                      <DueDate task={t} />
                      <div className="mt-3 flex items-center gap-2">
                        {t.assigneeName ? (
                          <>
                            <Avatar name={t.assigneeName} size={22} className="ring-0" />
                            <span className="truncate text-[12px] text-muted-foreground">{t.mine ? "Vos" : t.assigneeName}</span>
                          </>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">Sin asignar</span>
                        )}
                        <span className={cn("ml-auto text-[12px] tabular", over ? "font-medium text-danger" : "text-muted-foreground")}>
                          {Math.round(t.loggedHours * 10) / 10}
                          {t.estimatedHours ? `/${t.estimatedHours}h` : "h"}
                        </span>
                      </div>
                      {t.estimatedHours ? (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all duration-700", over ? "bg-danger" : "bg-accent")}
                            style={{ width: `${Math.min(100, (t.loggedHours / t.estimatedHours) * 100)}%` }}
                          />
                        </div>
                      ) : null}
                      {t.canEdit ? (
                        <div className="mt-3 flex justify-between opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => move(t, -1)}
                            disabled={ci === 0}
                            aria-label={`Mover "${t.title}" a ${COLUMNS[ci - 1]?.label ?? ""}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:invisible"
                          >
                            <ChevronLeft className="size-3.5" /> {COLUMNS[ci - 1]?.label}
                          </button>
                          <button
                            type="button"
                            onClick={() => move(t, 1)}
                            disabled={ci === COLUMNS.length - 1}
                            aria-label={`Mover "${t.title}" a ${COLUMNS[ci + 1]?.label ?? ""}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:invisible"
                          >
                            {COLUMNS[ci + 1]?.label} <ChevronRight className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 flex items-center gap-1 text-[11.5px] text-muted-foreground/70">
                          <Lock className="size-3" /> Solo lectura
                        </p>
                      )}
                    </motion.article>
                  );
                })}
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-muted-foreground">
                    Vacío
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
