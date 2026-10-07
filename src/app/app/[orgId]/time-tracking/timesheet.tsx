"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  FolderKanban,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeEntryWithTask } from "@/lib/data/time";
import {
  entryMinutes,
  formatMinutes,
  startOfDay,
  startOfWeek,
} from "@/lib/domain/time";
import {
  dayRow,
  formatBalance,
  localISO,
  taskGrid,
  timelineWindow,
  weekDays,
  weekSummary,
  type DayRow,
  type DayStatus,
} from "@/lib/domain/timesheet";
import { useHydrated, useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { deleteTaskEntry } from "./actions";
import { CorrectionForm } from "./correction-form";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const STATUS: Record<DayStatus, { label: string; tone: BadgeTone } | null> = {
  future: null,
  weekend: null,
  holiday: { label: "Festivo", tone: "neutral" },
  absence: { label: "Ausencia", tone: "neutral" },
  running: { label: "En curso", tone: "accent" },
  complete: { label: "Completa", tone: "success" },
  short: { label: "Incompleta", tone: "warning" },
  missing: { label: "Sin fichar", tone: "danger" },
};

/** Barra de la jornada: tramos de trabajo (azul) y pausas (ámbar) sobre la ventana horaria. */
function Timeline({
  row,
  from,
  to,
}: {
  row: DayRow;
  from: number;
  to: number;
}) {
  const span = to - from;
  const pct = (m: number) =>
    `${((Math.min(Math.max(m, from), to) - from) / span) * 100}%`;
  const muted =
    row.status === "weekend" ||
    row.status === "holiday" ||
    row.status === "absence";
  return (
    <div
      className={cn(
        "relative h-7 overflow-hidden rounded-lg",
        muted ? "bg-muted/40" : "bg-muted",
      )}
    >
      {/* Una línea cada 2 horas */}
      {Array.from({ length: Math.floor(span / 120) + 1 }, (_, i) => (
        <span
          key={i}
          className="absolute inset-y-0 w-px bg-border"
          style={{ left: `${((i * 120) / span) * 100}%` }}
        />
      ))}
      {row.segments.map((s) => (
        <span
          key={s.id + s.start}
          title={`${s.kind === "work" ? "Trabajo" : "Pausa"} · ${hhmm(s.start)} – ${s.open ? "ahora" : hhmm(s.end)}`}
          className={cn(
            "absolute inset-y-1 rounded-md",
            s.kind === "work"
              ? "bg-accent"
              : "bg-[repeating-linear-gradient(135deg,var(--warning)_0_4px,transparent_4px_7px)] opacity-80",
            s.open && "animate-pulse",
          )}
          style={{
            left: pct(s.start),
            width: `calc(${pct(s.end)} - ${pct(s.start)})`,
          }}
        />
      ))}
      {row.note ? (
        <span className="absolute inset-0 flex items-center px-3 text-[12px] text-muted-foreground">
          {row.note}
        </span>
      ) : null}
    </div>
  );
}

function DeleteTaskEntry({ orgId, id }: { orgId: string; id: string }) {
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
      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-4" strokeWidth={1.75} />
    </button>
  );
}

/** Tramos de un día, con la opción de pedir una corrección o borrar horas imputadas. */
function DayDetail({
  orgId,
  entries,
  pending,
}: {
  orgId: string;
  entries: TimeEntryWithTask[];
  pending: ReadonlySet<string>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const close = useCallback(() => setEditing(null), []);
  if (entries.length === 0)
    return (
      <p className="px-4 py-3 text-[13px] text-muted-foreground">
        Sin registros este día.
      </p>
    );
  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => (
        <Fragment key={e.id}>
          <li className="group flex items-center gap-3 px-4 py-2.5">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg",
                e.entry_type === "clock"
                  ? "bg-accent-soft text-accent"
                  : e.entry_type === "break"
                    ? "bg-warning/15 text-warning"
                    : "bg-muted",
              )}
            >
              {e.entry_type === "clock" ? (
                <Clock3 className="size-3.5" />
              ) : e.entry_type === "break" ? (
                <Coffee className="size-3.5" />
              ) : (
                <FolderKanban className="size-3.5" />
              )}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13.5px]">
              {e.entry_type === "task" ? (
                <>
                  {e.task?.title ?? "Tarea eliminada"}{" "}
                  <span className="text-muted-foreground">
                    · {e.task?.project?.name}
                  </span>
                </>
              ) : (
                <>
                  {e.entry_type === "break" ? "Pausa" : "Jornada"}{" "}
                  <span className="text-muted-foreground tabular">
                    {time(e.started_at)} —{" "}
                    {e.ended_at ? time(e.ended_at) : "en curso"}
                  </span>{" "}
                  {pending.has(e.id) ? (
                    <Badge tone="warning">Corrección pendiente</Badge>
                  ) : null}
                </>
              )}
            </p>
            <span className="text-[13px] font-medium tabular">
              {e.ended_at ? formatMinutes(entryMinutes(e)) : "En curso"}
            </span>
            {e.entry_type === "task" ? (
              <DeleteTaskEntry orgId={orgId} id={e.id} />
            ) : e.entry_type === "clock" && e.ended_at && !pending.has(e.id) ? (
              <button
                type="button"
                aria-label="Corregir fichaje"
                title="Corregir este fichaje"
                onClick={() => setEditing(editing === e.id ? null : e.id)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-4" strokeWidth={1.75} />
              </button>
            ) : (
              <span className="size-8" />
            )}
          </li>
          {editing === e.id ? (
            <li className="bg-muted/30 px-4 py-3">
              <CorrectionForm orgId={orgId} entry={e} onDone={close} />
            </li>
          ) : null}
        </Fragment>
      ))}
    </ul>
  );
}

export interface TimesheetProps {
  orgId: string;
  /** Lunes de la semana pedida (?semana=); null = la semana actual del navegador */
  weekParam: string | null;
  entries: TimeEntryWithTask[];
  expectedPerDayMin: number;
  holidays: { date: string; name: string }[];
  absences: { start_date: string; end_date: string; label: string }[];
  pendingEntryIds: string[];
  /** Formulario para imputar horas: va al lado de la hoja de horas por tarea */
  logSlot?: ReactNode;
}

export function Timesheet(props: TimesheetProps) {
  const hydrated = useHydrated();
  if (!hydrated) {
    // Agrupar por día y mostrar horas depende de la zona horaria del navegador
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  return <TimesheetView {...props} />;
}

function TimesheetView({
  orgId,
  weekParam,
  entries,
  expectedPerDayMin,
  holidays,
  absences,
  pendingEntryIds,
  logSlot,
}: TimesheetProps) {
  // Se renderiza después de hidratar: useNow ya tiene la hora del navegador (al minuto)
  const minute = Math.floor((useNow() ?? 0) / 60_000);
  const now = useMemo(() => new Date(minute * 60_000), [minute]);
  const monday = useMemo(
    () => startOfWeek(weekParam ? new Date(`${weekParam}T12:00:00`) : now),
    [weekParam, now],
  );
  const days = useMemo(() => weekDays(monday), [monday]);
  const isCurrentWeek = startOfWeek(now).getTime() === monday.getTime();

  const ctx = useMemo(() => {
    const absenceMap = new Map<string, string>();
    for (const a of absences) {
      for (
        let d = new Date(`${a.start_date}T12:00:00`);
        localISO(d) <= a.end_date;
        d.setDate(d.getDate() + 1)
      )
        absenceMap.set(localISO(d), a.label);
    }
    return {
      now,
      expectedPerDayMin,
      holidays: new Map(holidays.map((h) => [h.date, h.name])),
      absences: absenceMap,
    };
  }, [now, expectedPerDayMin, holidays, absences]);

  const rows = useMemo(
    () => days.map((d) => dayRow(entries, d, ctx)),
    [days, entries, ctx],
  );
  const summary = weekSummary(rows);
  const win = timelineWindow(rows);
  const pending = useMemo(() => new Set(pendingEntryIds), [pendingEntryIds]);
  const todayKey = startOfDay(now).getTime();
  const [open, setOpen] = useState<Set<number>>(() => new Set([todayKey]));
  const [forgotten, setForgotten] = useState(false);
  const closeForgotten = () => setForgotten(false);

  const grid = useMemo(
    () => taskGrid(entries, days, now),
    [entries, days, now],
  );
  const taskInfo = useMemo(
    () =>
      new Map(
        entries.flatMap((e) => (e.task ? [[e.task.id, e.task] as const] : [])),
      ),
    [entries],
  );

  const shift = (weeks: number) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + weeks * 7);
    return `?semana=${localISO(d)}`;
  };
  const range = `${days[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;
  const hours = Array.from(
    { length: Math.floor((win.to - win.from) / 120) + 1 },
    (_, i) => win.from + i * 120,
  );

  return (
    <div className="grid gap-4">
      {/* Registro de jornada: un día por fila */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Registro de jornada"
          description={isCurrentWeek ? "Esta semana" : range}
          action={
            <div className="flex items-center gap-1">
              <Link
                href={shift(-1)}
                aria-label="Semana anterior"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <span className="min-w-36 text-center text-[13px] font-medium tabular">
                {range}
              </span>
              <Link
                href={shift(1)}
                aria-label="Semana siguiente"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </Link>
              {!isCurrentWeek ? (
                <Link
                  href="?"
                  className="ml-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-accent hover:bg-accent-soft"
                >
                  Hoy
                </Link>
              ) : null}
            </div>
          }
        />

        {/* Resumen de la semana */}
        <dl className="mx-5 mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-border sm:grid-cols-4">
          {[
            { label: "Trabajadas", value: formatMinutes(summary.workedMin) },
            { label: "Previstas", value: formatMinutes(summary.expectedMin) },
            {
              label: "Saldo",
              value: formatBalance(summary.balanceMin),
              tone:
                summary.balanceMin < -15
                  ? "text-warning"
                  : summary.balanceMin > 15
                    ? "text-success"
                    : "",
            },
            { label: "Pausas", value: formatMinutes(summary.breakMin) },
          ].map((k, i) => (
            <div
              key={k.label}
              className={cn(
                "bg-muted/30 px-4 py-3",
                i > 0 && "border-l border-border",
                i === 2 && "max-sm:border-l-0 max-sm:border-t",
              )}
            >
              <dt className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">
                {k.label}
              </dt>
              <dd
                className={cn(
                  "mt-1 text-[20px] font-semibold tracking-tight tabular",
                  k.tone,
                )}
              >
                {k.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-t border-border text-[13px]">
            <thead>
              <tr className="bg-muted/30 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <th className="w-36 px-5 py-2 text-left font-medium">Día</th>
                <th className="px-3 py-2 text-left font-medium">
                  <div className="relative h-4">
                    {hours.map((h) => (
                      <span
                        key={h}
                        className="absolute -translate-x-1/2 tabular"
                        style={{
                          left: `${((h - win.from) / (win.to - win.from)) * 100}%`,
                        }}
                      >
                        {String(h / 60).padStart(2, "0")}
                      </span>
                    ))}
                  </div>
                </th>
                <th className="w-24 px-3 py-2 text-right font-medium">
                  Trabajado
                </th>
                <th className="w-20 px-3 py-2 text-right font-medium">
                  Previsto
                </th>
                <th className="w-24 px-3 py-2 text-right font-medium">Saldo</th>
                <th className="w-28 px-3 py-2 text-left font-medium">Estado</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = startOfDay(r.date).getTime();
                const expanded = open.has(key);
                const dayEntries = entries.filter(
                  (e) => startOfDay(new Date(e.started_at)).getTime() === key,
                );
                const badge = STATUS[r.status];
                const isToday = key === todayKey;
                const label = r.date.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                });
                return (
                  <Fragment key={key}>
                    <tr
                      className={cn(
                        "border-t border-border transition-colors hover:bg-muted/30",
                        (r.status === "weekend" || r.status === "future") &&
                          "text-muted-foreground",
                        isToday && "bg-accent-soft/40",
                      )}
                    >
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setOpen((s) => {
                              const next = new Set(s);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                          aria-expanded={expanded}
                          aria-label={`Ver el detalle del ${label}`}
                          className="text-left"
                        >
                          <span className="block font-medium capitalize">
                            {isToday
                              ? "Hoy"
                              : r.date.toLocaleDateString("es-ES", {
                                  weekday: "long",
                                })}
                          </span>
                          <span className="text-[12px] text-muted-foreground">
                            {r.date.toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <Timeline row={r} from={win.from} to={win.to} />
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular">
                        {r.workedMin ? formatMinutes(r.workedMin) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular">
                        {r.expectedMin ? formatMinutes(r.expectedMin) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-medium tabular",
                          r.balanceMin !== null &&
                            r.balanceMin < -15 &&
                            "text-warning",
                          r.balanceMin !== null &&
                            r.balanceMin > 15 &&
                            "text-success",
                        )}
                      >
                        {r.balanceMin === null
                          ? "—"
                          : formatBalance(r.balanceMin)}
                      </td>
                      <td className="px-3 py-3">
                        {badge ? (
                          <Badge tone={badge.tone} dot={r.status === "running"}>
                            {badge.label}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="pr-3">
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-hidden
                          onClick={() =>
                            setOpen((s) => {
                              const next = new Set(s);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              expanded && "rotate-180",
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden border-t border-dashed border-border bg-muted/20"
                            >
                              <DayDetail
                                orgId={orgId}
                                entries={dayEntries}
                                pending={pending}
                              />
                            </motion.div>
                          </td>
                        </tr>
                      ) : null}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-accent" /> Trabajo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-[repeating-linear-gradient(135deg,var(--warning)_0_3px,transparent_3px_5px)]" />{" "}
              Pausa
            </span>
          </div>
          <button
            type="button"
            onClick={() => setForgotten((f) => !f)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <Plus className="size-4" /> Agregar un fichaje olvidado
          </button>
        </div>
        {forgotten ? (
          <div className="border-t border-border px-5 py-4">
            <CorrectionForm orgId={orgId} onDone={closeForgotten} />
          </div>
        ) : null}
      </Card>

      {/* Hoja de horas por tarea, con el formulario para imputar al lado */}
      <div className="grid items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Horas por tarea"
            description={`${formatMinutes(grid.total)} imputadas ${isCurrentWeek ? "esta semana" : `del ${range}`}`}
          />
          {grid.rows.length === 0 ? (
            <p className="px-5 pt-3 pb-5 text-[13px] text-muted-foreground">
              Todavía no imputaste horas a tareas en esta semana.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[580px] border-t border-border text-[13px]">
                <thead>
                  <tr className="bg-muted/30 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <th className="px-5 py-2 text-left font-medium">Tarea</th>
                    {days.map((d) => (
                      <th
                        key={d.getTime()}
                        className={cn(
                          "w-16 px-2 py-2 text-right font-medium",
                          startOfDay(d).getTime() === todayKey && "text-accent",
                        )}
                      >
                        {d
                          .toLocaleDateString("es-ES", { weekday: "short" })
                          .replace(".", "")}{" "}
                        {d.getDate()}
                      </th>
                    ))}
                    <th className="w-20 px-5 py-2 text-right font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map((r) => {
                    const task = taskInfo.get(r.taskId);
                    return (
                      <tr key={r.taskId} className="border-t border-border">
                        <td className="px-5 py-2.5">
                          <p className="truncate font-medium">
                            {task?.title ?? "Tarea"}
                          </p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {task?.project?.name}
                          </p>
                        </td>
                        {r.perDay.map((m, i) => (
                          <td
                            key={i}
                            className={cn(
                              "px-2 py-2.5 text-right tabular",
                              m ? "font-medium" : "text-muted-foreground/50",
                            )}
                          >
                            {m ? formatMinutes(m) : "—"}
                          </td>
                        ))}
                        <td className="px-5 py-2.5 text-right font-semibold tabular">
                          {formatMinutes(r.total)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-border bg-muted/30 font-semibold">
                    <td className="px-5 py-2.5">Total</td>
                    {grid.perDay.map((m, i) => (
                      <td key={i} className="px-2 py-2.5 text-right tabular">
                        {m ? formatMinutes(m) : "—"}
                      </td>
                    ))}
                    <td className="px-5 py-2.5 text-right tabular">
                      {formatMinutes(grid.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {logSlot}
      </div>
    </div>
  );
}
