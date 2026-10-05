"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tarjeta con un halo que sigue al cursor (solo con puntero fino; en touch queda estática). */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--y", `${e.clientY - rect.top}px`);
      }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-border bg-card",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
        "before:bg-[radial-gradient(420px_circle_at_var(--x,50%)_var(--y,50%),var(--accent-soft),transparent_60%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
