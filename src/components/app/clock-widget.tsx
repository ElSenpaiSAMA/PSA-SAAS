"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/submit-button";
import { clockIn, clockOut } from "@/app/app/[orgId]/time-tracking/actions";
import { useHydrated, useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

function useElapsed(startedAt: string | null) {
  const now = useNow();
  if (!startedAt) return null;
  // Antes de hidratar no hay hora de cliente: placeholder estable (igual en servidor y cliente)
  if (now === null) return ["--", "--", "--"];
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0"));
}

export function ClockWidget({
  orgId,
  openSince,
  todayMinutes,
  size = "md",
}: {
  orgId: string;
  openSince: string | null;
  todayMinutes: number;
  size?: "md" | "lg";
}) {
  const [pending, startTransition] = useTransition();
  const elapsed = useElapsed(openSince);
  const active = !!openSince;

  const toggle = () =>
    startTransition(async () => {
      const result = active ? await clockOut(orgId) : await clockIn(orgId);
      if (result.status === "error") toast.error(result.message);
      else toast.success(result.message, { description: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) });
    });

  const hydrated = useHydrated();
  // Hora local del navegador: solo tras hidratar (el servidor corre en UTC)
  const since =
    openSince && hydrated
      ? new Date(openSince).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
      : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card transition-colors duration-700",
        active ? "border-success/30" : "border-border",
        size === "lg" ? "p-6 sm:p-8" : "p-5",
      )}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-success/20 blur-3xl"
        initial={false}
        animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.6 }}
        transition={{ duration: 1, ease: EASE }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="relative flex size-2">
              {active ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /> : null}
              <span className={cn("relative inline-flex size-2 rounded-full", active ? "bg-success" : "bg-border-strong")} />
            </span>
            {active ? (since ? `Trabajando desde las ${since}` : "Trabajando") : "Fuera de jornada"}
          </div>

          <div
            className={cn(
              "mt-2 font-mono font-medium tracking-tight tabular",
              size === "lg" ? "text-[44px] leading-none sm:text-[56px]" : "text-[34px] leading-none",
            )}
            aria-live="polite"
          >
            {elapsed ? (
              <span>
                {elapsed[0]}
                <span className="animate-pulse opacity-40">:</span>
                {elapsed[1]}
                <span className="text-muted-foreground">:{elapsed[2]}</span>
              </span>
            ) : (
              <span className="text-muted-foreground/50">00:00:00</span>
            )}
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Hoy llevás {Math.floor(todayMinutes / 60)}h {String(todayMinutes % 60).padStart(2, "0")}m fichadas
          </p>
        </div>

        <motion.button
          type="button"
          onClick={toggle}
          disabled={pending}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative inline-flex h-12 min-w-40 items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 text-[15px] font-medium transition-colors duration-300 disabled:opacity-70",
            active
              ? "bg-card text-foreground ring-1 ring-border-strong hover:bg-muted"
              : "bg-foreground text-background hover:bg-foreground/90",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={pending ? "pending" : active ? "out" : "in"}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="inline-flex items-center gap-2"
            >
              {pending ? <Spinner /> : null}
              {pending ? "Registrando…" : active ? "Fichar salida" : "Fichar entrada"}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
