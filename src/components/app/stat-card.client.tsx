"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/motion";
import { formatMinutes } from "@/lib/domain/time";
import { formatMoney } from "@/lib/domain/work-orders";

export type StatFormat = "number" | "minutes" | "percent" | "days" | "currency";

const formatters: Record<StatFormat, (n: number) => string> = {
  number: (n) => Math.round(n).toLocaleString("es-ES"),
  minutes: (n) => formatMinutes(Math.round(n)),
  percent: (n) => `${Math.round(n)}%`,
  days: (n) => `${Math.round(n)} ${Math.round(n) === 1 ? "día" : "días"}`,
  currency: (n) => formatMoney(n),
};

export function StatValue({ value, format }: { value: number; format: StatFormat }) {
  return (
    <AnimatedNumber
      value={value}
      format={formatters[format]}
      className="mt-3 block text-[28px] leading-none font-semibold tracking-[-0.03em]"
    />
  );
}

export function FadeIn({ index, className, children }: { index: number; className?: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
