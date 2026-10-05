"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";

const EASE = [0.16, 1, 0.3, 1] as const;

const events = [
  { name: "Ana Torres", text: "fichó entrada", meta: "09:02" },
  { name: "Carlos Ruiz", text: "aprobó vacaciones de Diego", meta: "5 días" },
  { name: "Diego Fernández", text: "cargó horas en API de pagos v2", meta: "4h 30m" },
  { name: "Sofía Navarro", text: "invitó a un nuevo miembro", meta: "Diseño" },
  { name: "Laura Méndez", text: "creó el proyecto Portal clientes", meta: "320h" },
];

export function AuthShowcase() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, []);

  const visible = [0, 1, 2].map((offset) => {
    const i = (tick + offset) % events.length;
    return { ...events[i], key: tick + offset };
  });

  return (
    <aside className="bg-noise relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between dark:bg-card dark:text-foreground">
      <div className="pointer-events-none absolute -top-32 -right-32 size-[520px] rounded-full bg-accent/35 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 size-[420px] rounded-full bg-accent/20 blur-[120px]" />

      <div className="relative p-14">
        <p className="text-[13px] font-medium opacity-60">En vivo en tu organización</p>
      </div>

      <div className="relative px-14">
        <div className="relative h-[264px]">
          <AnimatePresence initial={false}>
            {visible.map((e, i) => (
              <motion.div
                key={e.key}
                layout
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1 - i * 0.28, y: i * 88, scale: 1 - i * 0.03 }}
                exit={{ opacity: 0, y: -30, scale: 0.96 }}
                transition={{ duration: 0.9, ease: EASE }}
                className="absolute inset-x-0 top-0 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl dark:border-border dark:bg-muted/60"
              >
                <Avatar name={e.name} size={40} className="ring-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">
                    <span className="font-medium">{e.name}</span> <span className="opacity-60">{e.text}</span>
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[12px] opacity-50">{e.meta}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative p-14">
        <blockquote className="max-w-md text-[28px] leading-[1.15] font-semibold tracking-[-0.03em]">
          Menos tiempo gestionando el tiempo.{" "}
          <span className="font-serif font-normal italic opacity-70">Más tiempo haciendo.</span>
        </blockquote>
      </div>
    </aside>
  );
}
