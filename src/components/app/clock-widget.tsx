"use client";

import { AnimatePresence, motion } from "motion/react";
import { Coffee, LogIn, LogOut, Play } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/submit-button";
import { clockIn, clockOut, pauseClock, resumeClock } from "@/app/app/[orgId]/time-tracking/actions";
import type { ActionState } from "@/lib/actions";
import type { ClockState } from "@/lib/domain/time";
import { useHydrated, useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const hms = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(pad);
};
const hm = (minutes: number) => `${Math.floor(minutes / 60)}h ${pad(Math.floor(minutes % 60))}m`;

/**
 * Fichaje con pausas. El reloj grande muestra el tiempo trabajado hoy
 * (o la duración de la pausa en curso); los tramos cerrados vienen del
 * servidor y el tramo abierto se suma en vivo en el cliente.
 */
export function ClockWidget({
  orgId,
  state,
  workedMinutes,
  breakMinutes,
  size = "md",
}: {
  orgId: string;
  state: ClockState;
  /** Minutos trabajados hoy en tramos ya cerrados */
  workedMinutes: number;
  /** Minutos de pausa hoy en tramos ya cerrados */
  breakMinutes: number;
  size?: "md" | "lg";
}) {
  const [pending, startTransition] = useTransition();
  const now = useNow();
  const hydrated = useHydrated();

  const openSeconds = state.status !== "off" && now !== null ? (now - new Date(state.since).getTime()) / 1000 : 0;
  const workedSeconds = workedMinutes * 60 + (state.status === "working" ? openSeconds : 0);
  const breakTotal = breakMinutes + (state.status === "paused" ? openSeconds / 60 : 0);
  const big = state.status === "paused" ? hms(openSeconds) : hms(workedSeconds);
  // Antes de hidratar no hay hora de cliente: placeholder estable
  const display = state.status !== "off" && now === null ? ["--", "--", "--"] : big;

  const since =
    state.status !== "off" && hydrated
      ? new Date(state.since).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
      : null;

  const run = (fn: (orgId: string) => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn(orgId);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message, { description: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) });
    });

  const working = state.status === "working";
  const paused = state.status === "paused";
  const label = working
    ? since
      ? `Trabajando desde las ${since}`
      : "Trabajando"
    : paused
      ? since
        ? `En pausa desde las ${since}`
        : "En pausa"
      : "Fuera de jornada";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card transition-colors duration-700",
        working ? "border-success/30" : paused ? "border-warning/40" : "border-border",
        size === "lg" ? "p-6 sm:p-8" : "p-5",
      )}
    >
      <motion.div
        aria-hidden
        className={cn("pointer-events-none absolute -top-24 -right-24 size-64 rounded-full blur-3xl", paused ? "bg-warning/20" : "bg-success/20")}
        initial={false}
        animate={{ opacity: state.status === "off" ? 0 : 1, scale: state.status === "off" ? 0.6 : 1 }}
        transition={{ duration: 1, ease: EASE }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="relative flex size-2">
              {working ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /> : null}
              <span className={cn("relative inline-flex size-2 rounded-full", working ? "bg-success" : paused ? "bg-warning" : "bg-border-strong")} />
            </span>
            {label}
          </div>

          <div
            className={cn(
              "mt-2 font-mono font-medium tracking-tight tabular",
              size === "lg" ? "text-[44px] leading-none sm:text-[56px]" : "text-[34px] leading-none",
              paused && "text-warning",
            )}
            aria-live="polite"
          >
            {state.status === "off" && workedMinutes === 0 ? (
              <span className="text-muted-foreground/50">00:00:00</span>
            ) : (
              <span>
                {display[0]}
                <span className={cn("opacity-40", state.status !== "off" && "animate-pulse")}>:</span>
                {display[1]}
                <span className="text-muted-foreground">:{display[2]}</span>
              </span>
            )}
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {paused ? `Hoy llevás ${hm(workedMinutes)} trabajadas` : "Trabajado hoy"}
            {breakTotal >= 1 || paused ? ` · ${hm(breakTotal)} de pausa` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {working ? (
            <SecondaryButton disabled={pending} onClick={() => run(pauseClock)} icon={<Coffee className="size-4" strokeWidth={1.75} />}>
              Pausar
            </SecondaryButton>
          ) : null}
          {state.status !== "off" ? (
            <SecondaryButton disabled={pending} onClick={() => run(clockOut)} icon={<LogOut className="size-4" strokeWidth={1.75} />}>
              Fichar salida
            </SecondaryButton>
          ) : null}
          {state.status !== "working" ? (
            <motion.button
              type="button"
              onClick={() => run(paused ? resumeClock : clockIn)}
              disabled={pending}
              whileTap={{ scale: 0.95 }}
              className="relative inline-flex h-12 min-w-40 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-foreground px-6 text-[15px] font-medium text-background transition-colors duration-300 hover:bg-foreground/90 disabled:opacity-70"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={pending ? "pending" : state.status}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -18, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="inline-flex items-center gap-2"
                >
                  {pending ? <Spinner /> : paused ? <Play className="size-4" /> : <LogIn className="size-4" />}
                  {pending ? "Registrando…" : paused ? "Reanudar" : "Fichar entrada"}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SecondaryButton({
  children,
  icon,
  ...props
}: { children: string; icon: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-card px-5 text-[15px] font-medium text-foreground ring-1 ring-border-strong transition-colors hover:bg-muted disabled:opacity-70"
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {icon}
      {children}
    </motion.button>
  );
}
