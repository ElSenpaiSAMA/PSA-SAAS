"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { formatMinutes, isSameDay, startOfWeek, weekTotals } from "@/lib/domain/time";
import type { TimeEntry } from "@/lib/supabase/database.types";
import { useHydrated } from "@/lib/use-now";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const DAY = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function WeekChart({ entries, dailyTargetMinutes }: { entries: TimeEntry[]; dailyTargetMinutes: number }) {
  // Los días se calculan en la zona horaria del navegador: hasta hidratar, barras en cero
  // (que luego crecen animadas) para que servidor y cliente rendericen lo mismo.
  const hydrated = useHydrated();
  const { days, today } = useMemo(() => {
    const now = new Date();
    const totals = weekTotals(hydrated ? entries : [], startOfWeek(now), now);
    return { days: totals, today: hydrated ? now : null };
  }, [entries, hydrated]);

  const max = Math.max(dailyTargetMinutes * 1.25, ...days.map((d) => Math.max(d.clockMinutes, d.taskMinutes)));
  const targetPct = (dailyTargetMinutes / max) * 100;

  return (
    <div>
      <div className="relative flex h-48 items-end gap-2 sm:gap-4">
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-strong"
          style={{ bottom: `${targetPct}%` }}
        >
          <span className="absolute -top-5 right-0 text-[11px] text-muted-foreground">
            Objetivo {formatMinutes(dailyTargetMinutes)}
          </span>
        </div>
        {days.map((d, i) => {
          const isToday = today !== null && isSameDay(d.date, today);
          return (
            <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-foreground px-2.5 py-1.5 text-[11.5px] whitespace-nowrap text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {formatMinutes(d.clockMinutes)} fichadas · {formatMinutes(d.taskMinutes)} en tareas
              </div>
              <div className="relative flex h-full items-end justify-center gap-1">
                <motion.div
                  className={cn("w-full max-w-7 rounded-t-lg", isToday ? "bg-foreground" : "bg-foreground/80 dark:bg-foreground/70")}
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.clockMinutes / max) * 100}%` }}
                  transition={{ delay: i * 0.05, duration: 0.9, ease: EASE }}
                />
                <motion.div
                  className="w-full max-w-7 rounded-t-lg bg-accent"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.taskMinutes / max) * 100}%` }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.9, ease: EASE }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 sm:gap-4">
        {days.map((d, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 text-center text-[12px]",
              today && isSameDay(d.date, today) ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {DAY[i]}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-foreground/80" /> Fichado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" /> Imputado a tareas
        </span>
      </div>
    </div>
  );
}
