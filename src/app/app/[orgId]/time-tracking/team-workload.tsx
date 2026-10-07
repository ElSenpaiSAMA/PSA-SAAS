"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { entryMinutes, formatMinutes, workloadLevel, workloadPercent, type WorkloadLevel } from "@/lib/domain/time";
import type { TimeEntry } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const LEVEL: Record<WorkloadLevel, { label: string; tone: BadgeTone; bar: string }> = {
  low: { label: "Baja", tone: "neutral", bar: "bg-border-strong" },
  healthy: { label: "Saludable", tone: "success", bar: "bg-success" },
  high: { label: "Alta", tone: "warning", bar: "bg-warning" },
  overloaded: { label: "Sobrecarga", tone: "danger", bar: "bg-danger" },
};

export interface TeamMember {
  membershipId: string;
  name: string;
  position: string | null;
  weeklyHours: number;
}

export function TeamWorkload({ members, entries }: { members: TeamMember[]; entries: TimeEntry[] }) {
  const rows = useMemo(() => {
    const now = new Date();
    return members
      .map((m) => {
        const mine = entries.filter((e) => e.membership_id === m.membershipId);
        const clock = mine.filter((e) => e.entry_type === "clock").reduce((s, e) => s + entryMinutes(e, now), 0);
        const task = mine.filter((e) => e.entry_type === "task").reduce((s, e) => s + entryMinutes(e, now), 0);
        const pct = workloadPercent(clock, m.weeklyHours);
        const working = mine.some((e) => e.entry_type === "clock" && e.ended_at === null);
        return { ...m, clock, task, pct, level: workloadLevel(pct), working };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [members, entries]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13.5px]">
        <thead>
          <tr className="text-[12px] text-muted-foreground">
            <th className="pb-3 font-medium">Persona</th>
            <th className="pb-3 font-medium">Fichado</th>
            <th className="pb-3 font-medium">En tareas</th>
            <th className="w-[34%] pb-3 font-medium">Carga semanal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={r.membershipId}>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={r.name} size={32} />
                    {r.working ? (
                      <span
                        className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-success"
                        title="Trabajando ahora"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{r.position ?? "—"}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4 tabular">{formatMinutes(r.clock)}</td>
              <td className="py-3 pr-4 tabular text-muted-foreground">{formatMinutes(r.task)}</td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn("h-full rounded-full", LEVEL[r.level].bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(r.pct, 100)}%` }}
                      transition={{ delay: 0.1 + i * 0.05, duration: 1, ease: EASE }}
                    />
                  </div>
                  <span className="w-10 text-right text-[12.5px] tabular">{r.pct}%</span>
                  <Badge tone={LEVEL[r.level].tone} className="hidden w-24 justify-center sm:inline-flex">
                    {LEVEL[r.level].label}
                  </Badge>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
