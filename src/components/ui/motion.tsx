"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE } },
};

/** Revela sus hijos `RevealItem` en cascada cuando entran en viewport. */
export function Reveal({
  children,
  className,
  stagger = 0.08,
  delay = 0,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/** Número que cuenta hasta su valor al entrar en pantalla. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("es-ES", { useGrouping: "always" }),
  className,
  duration = 1.2,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  // Siempre arranca en 0: en el servidor no se sabe si el usuario prefiere menos
  // movimiento, y el primer render del cliente tiene que coincidir (hidratación).
  const mv = useMotionValue(0);
  const text = useTransform(mv, (n) => format(n));

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, { duration, ease: EASE });
    return () => controls.stop();
  }, [inView, value, duration, mv, reduced]);

  return <motion.span ref={ref} className={cn("tabular", className)}>{text}</motion.span>;
}

/** Barra de progreso que se llena con easing al montarse. */
export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  className,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "success" | "warning" | "danger" | "foreground";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  const color = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    foreground: "bg-foreground",
  }[tone];

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: EASE }}
      />
    </div>
  );
}
