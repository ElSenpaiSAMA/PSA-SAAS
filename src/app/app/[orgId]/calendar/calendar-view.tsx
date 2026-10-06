"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck2, ClipboardList, Palmtree, PartyPopper, SquareCheckBig, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestVacation } from "@/app/app/[orgId]/vacations/actions";
import { idle } from "@/lib/actions";
import {
  daysOfWeek,
  layoutWeek,
  orderedRange,
  shiftRange,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/lib/domain/calendar";
import { daysBetween, formatRange, todayISO, type ISODate, type Week } from "@/lib/domain/periods";
import { businessDays } from "@/lib/domain/vacations";
import { useHydrated } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { moveTask } from "./actions";

const EASE = [0.16, 1, 0.3, 1] as const;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_LANES = 3;

const KINDS: { kind: Exclude<CalendarEventKind, "holiday">; label: string; icon: typeof ClipboardList }[] = [
  { kind: "task", label: "Tareas", icon: SquareCheckBig },
  { kind: "workOrder", label: "Órdenes de trabajo", icon: ClipboardList },
  { kind: "absence", label: "Ausencias", icon: Palmtree },
];

function barStyle(e: CalendarEvent) {
  switch (e.kind) {
    case "task":
      return e.status === "done"
        ? "bg-muted text-muted-foreground line-through decoration-border-strong"
        : e.mine
          ? "bg-accent text-accent-foreground"
          : "bg-accent-soft text-foreground";
    case "workOrder":
      return "border border-border-strong bg-card text-muted-foreground";
    case "absence":
      return e.status === "pending"
        ? "border border-dashed border-warning bg-warning/10 text-foreground"
        : "bg-success/15 text-foreground";
    default:
      return "";
  }
}

function QuickVacation({
  orgId,
  range,
  holidays,
  onClose,
}: {
  orgId: string;
  range: { start: ISODate; end: ISODate };
  holidays: Set<string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState(requestVacation.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);
  const days = businessDays({ start_date: range.start, end_date: range.end }, holidays);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") {
      toast.success(state.message);
      onClose();
    } else {
      toast.error(state.message);
    }
  }, [state, onClose]);

  return (
    <motion.form
      action={action}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 pl-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.4)] backdrop-blur-xl"
    >
      <input type="hidden" name="startDate" value={range.start} />
      <input type="hidden" name="endDate" value={range.end} />
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-success/15 text-success">
          <Palmtree className="size-[18px]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[14px] font-medium">{formatRange(range.start, range.end)}</p>
          <p className="text-[12px] text-muted-foreground">
            {days} {days === 1 ? "día hábil" : "días hábiles"}
          </p>
        </div>
      </div>
      <Input name="reason" placeholder="Motivo (opcional)" className="h-10 min-w-40 flex-1" />
      <SubmitButton size="md" pendingLabel="Enviando…" disabled={days === 0}>
        Pedir vacaciones
      </SubmitButton>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cancelar selección"
        className="inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
    </motion.form>
  );
}

export function CalendarView({
  orgId,
  events: initialEvents,
  weeks,
  monthStart,
  view,
  weekHref,
}: {
  orgId: string;
  events: CalendarEvent[];
  weeks: Week[];
  /** Mes visible (para atenuar días de otros meses); null en vista semana */
  monthStart: ISODate | null;
  view: "month" | "week";
  /** href de la vista semana para un lunes dado */
  weekHref: Record<ISODate, string>;
}) {
  const hydrated = useHydrated();
  const today = hydrated ? todayISO() : null;
  const [events, setEvents] = useState(initialEvents);
  const [kinds, setKinds] = useState<Set<CalendarEventKind>>(new Set(["task", "workOrder", "absence"]));
  const [onlyMine, setOnlyMine] = useState(false);
  const [selection, setSelection] = useState<{ anchor: ISODate; current: ISODate } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [dropTarget, setDropTarget] = useState<ISODate | null>(null);
  const drag = useRef<{ id: string; offset: number } | null>(null);
  const [, startMove] = useTransition();

  // Los datos del servidor mandan cuando cambian (p. ej. tras revalidar)
  const [synced, setSynced] = useState(initialEvents);
  if (synced !== initialEvents) {
    setSynced(initialEvents);
    setEvents(initialEvents);
  }

  const holidays = useMemo(() => {
    const map = new Map<ISODate, string>();
    for (const e of events) if (e.kind === "holiday") map.set(e.start, e.title);
    return map;
  }, [events]);
  const holidaySet = useMemo(() => new Set(holidays.keys()), [holidays]);

  const visible = events.filter((e) => e.kind !== "holiday" && kinds.has(e.kind) && (!onlyMine || e.mine));
  const range = selection ? orderedRange(selection.anchor, selection.current) : null;

  useEffect(() => {
    if (!selecting) return;
    const end = () => setSelecting(false);
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, [selecting]);

  const toggleKind = (kind: CalendarEventKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const drop = (day: ISODate) => {
    const info = drag.current;
    drag.current = null;
    setDropTarget(null);
    const event = info && events.find((e) => e.id === info.id);
    if (!info || !event) return;
    const newStart = daysBetween("1970-01-01", day) - info.offset;
    const delta = newStart - daysBetween("1970-01-01", event.start);
    if (delta === 0) return;
    const moved = shiftRange(event.start, event.end, delta);
    const previous = events;
    setEvents((list) => list.map((e) => (e.id === event.id ? { ...e, ...moved } : e)));
    startMove(async () => {
      const r = await moveTask(orgId, event.id.replace(/^task:/, ""), event.hasStart ? moved.start : null, moved.end);
      if (r.status === "error") {
        setEvents(previous);
        toast.error(r.message);
      } else {
        toast.success(r.message, { description: `${event.title} · ${formatRange(moved.start, moved.end)}` });
      }
    });
  };

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {KINDS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={kinds.has(kind)}
            onClick={() => toggleKind(kind)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-all",
              kinds.has(kind)
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
            {label}
          </button>
        ))}
        <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-muted-foreground select-none">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-[var(--accent)]" />
          Solo lo mío
        </label>
        <span className="ml-auto hidden text-[12px] text-muted-foreground lg:inline">
          Arrastrá sobre días libres para pedir vacaciones · arrastrá una tarea para reprogramarla
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card select-none">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-2 text-[12px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week) => {
          const days = daysOfWeek(week);
          const { slots, lanes } = layoutWeek(visible, week);
          const maxLanes = view === "month" ? MONTH_LANES : Math.max(lanes, 4);
          const hiddenPerDay = days.map((_, i) => slots.filter((s) => s.lane >= maxLanes && s.col <= i && i < s.col + s.span).length);
          const laneHeight = view === "month" ? 24 : 30;

          return (
            <div key={week.start} className="relative border-b border-border last:border-b-0">
              {/* Celdas de días: selección y destino de arrastre */}
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const outside = monthStart !== null && day.slice(0, 7) !== monthStart.slice(0, 7);
                  const holiday = holidays.get(day);
                  const weekend = i >= 5;
                  const selected = range !== null && day >= range.start && day <= range.end;
                  return (
                    <div
                      key={day}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        if (e.shiftKey && selection) setSelection({ ...selection, current: day });
                        else setSelection({ anchor: day, current: day });
                        setSelecting(true);
                      }}
                      onPointerEnter={() => selecting && setSelection((s) => (s ? { ...s, current: day } : s))}
                      onPointerUp={() => setSelecting(false)}
                      onDragOver={(e) => {
                        if (!drag.current) return;
                        e.preventDefault();
                        setDropTarget(day);
                      }}
                      onDragLeave={() => setDropTarget((t) => (t === day ? null : t))}
                      onDrop={(e) => {
                        e.preventDefault();
                        drop(day);
                      }}
                      className={cn(
                        "relative border-r border-border p-1.5 transition-colors last:border-r-0",
                        view === "month" ? "min-h-[132px]" : "min-h-[320px]",
                        (weekend || holiday) && "bg-muted/40",
                        outside && "bg-muted/20",
                        selected && "bg-success/10",
                        dropTarget === day && "bg-accent-soft ring-2 ring-accent ring-inset",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <Link
                          href={weekHref[week.start] ?? "#"}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-full text-[12.5px] tabular transition-colors hover:bg-muted",
                            outside ? "text-muted-foreground/50" : "text-foreground",
                            today === day && "bg-foreground font-semibold text-background hover:bg-foreground",
                          )}
                        >
                          {Number(day.slice(8))}
                        </Link>
                        {holiday ? (
                          <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] font-medium text-danger" title={holiday}>
                            <PartyPopper className="size-3 shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{holiday}</span>
                          </span>
                        ) : null}
                      </div>
                      {hiddenPerDay[i] > 0 ? (
                        <Link
                          href={weekHref[week.start] ?? "#"}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute bottom-1.5 left-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          +{hiddenPerDay[i]} más
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Eventos */}
              <div className="pointer-events-none absolute inset-x-0 top-9 grid grid-cols-7 px-0.5" style={{ gridAutoRows: `${laneHeight}px` }}>
                {slots
                  .filter((s) => s.lane < maxLanes)
                  .map((s) => (
                    <motion.div
                      key={`${s.event.id}-${week.start}`}
                      layout
                      transition={{ duration: 0.3, ease: EASE }}
                      style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.lane + 1 }}
                      className="px-0.5 py-0.5"
                    >
                      <Link
                        href={s.event.href ?? "#"}
                        draggable={!!s.event.movable}
                        onPointerDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const grabbedCol = s.col + Math.floor(((e.clientX - rect.left) / rect.width) * s.span);
                          const grabbedDay = days[Math.min(6, Math.max(0, grabbedCol))];
                          drag.current = { id: s.event.id, offset: daysBetween(s.event.start, grabbedDay) };
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          drag.current = null;
                          setDropTarget(null);
                        }}
                        title={[s.event.title, s.event.subtitle, formatRange(s.event.start, s.event.end)].filter(Boolean).join(" · ")}
                        className={cn(
                          "pointer-events-auto flex h-full items-center gap-1.5 overflow-hidden px-2 text-[11.5px] leading-none font-medium whitespace-nowrap transition-[filter,transform] hover:brightness-95 active:scale-[0.99]",
                          barStyle(s.event),
                          s.continuesBefore ? "rounded-l-none" : "rounded-l-md",
                          s.continuesAfter ? "rounded-r-none" : "rounded-r-md",
                          s.event.movable && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        {s.event.kind === "workOrder" ? <ClipboardList className="size-3 shrink-0" strokeWidth={2} /> : null}
                        {s.event.kind === "absence" ? <Palmtree className="size-3 shrink-0" strokeWidth={2} /> : null}
                        <span className="truncate">{s.event.title}</span>
                        {view === "week" && s.event.subtitle ? (
                          <span className="truncate font-normal opacity-70">· {s.event.subtitle}</span>
                        ) : null}
                      </Link>
                    </motion.div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm bg-accent" /> Mis tareas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm bg-accent-soft" /> Tareas del equipo</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm border border-border-strong" /> Órdenes de trabajo</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm bg-success/15" /> Vacaciones</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm border border-dashed border-warning" /> Pendiente</span>
        <span className="inline-flex items-center gap-1.5 text-danger"><PartyPopper className="size-3" /> Festivo</span>
        <span className="inline-flex items-center gap-1.5"><CalendarCheck2 className="size-3" /> Click en el número de un día: vista semana</span>
      </div>

      <AnimatePresence>
        {range && !selecting ? (
          <QuickVacation key={`${range.start}-${range.end}`} orgId={orgId} range={range} holidays={holidaySet} onClose={() => setSelection(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
