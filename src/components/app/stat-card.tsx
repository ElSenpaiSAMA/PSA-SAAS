"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/motion";
import { formatMinutes } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

type Format = "number" | "minutes" | "percent" | "days";

const formatters: Record<Format, (n: number) => string> = {
  number: (n) => Math.round(n).toLocaleString("es-ES"),
  minutes: (n) => formatMinutes(Math.round(n)),
  percent: (n) => `${Math.round(n)}%`,
  days: (n) => `${Math.round(n)} ${Math.round(n) === 1 ? "día" : "días"}`,
};

export function StatCard({
  label,
  value,
  format = "number",
  icon: Icon,
  hint,
  tone,
  index = 0,
  children,
}: {
  label: string;
  value: number;
  format?: Format;
  icon: LucideIcon;
  hint?: ReactNode;
  tone?: "warning" | "danger" | "success";
  index?: number;
  children?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <Icon
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-500 group-hover:scale-110",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-danger",
            tone === "success" && "text-success",
          )}
          strokeWidth={1.75}
        />
      </div>
      <AnimatedNumber
        value={value}
        format={formatters[format]}
        className="mt-3 block text-[28px] leading-none font-semibold tracking-[-0.03em]"
      />
      {hint ? <p className="mt-2 text-[12.5px] text-muted-foreground">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </motion.div>
  );
}
