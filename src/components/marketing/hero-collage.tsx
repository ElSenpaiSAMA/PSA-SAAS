"use client";

import { motion, useReducedMotion, type MotionValue } from "motion/react";
import { Coffee, Palmtree, Receipt, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";

// Fondo del hero: tarjetas reales de la app flotando a los costados del titular.
// Es decorativo (aria-hidden) y determinista: nada de hora real ni aleatorios en el
// render, para que el HTML del servidor y del cliente coincidan al hidratar.

const CARD =
  "absolute rounded-2xl border border-border bg-card/90 p-3 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.25)] backdrop-blur dark:shadow-[0_12px_40px_-12px_rgb(0_0_0/0.7)]";

function Float({ className, delay, amp = 10, children }: { className: string; delay: number; amp?: number; children: ReactNode }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={still ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -amp, 0] }}
      transition={
        still
          ? { duration: 0.6, delay }
          : { opacity: { duration: 0.8, delay: 0.6 + delay }, y: { duration: 7 + delay, delay, repeat: Infinity, ease: "easeInOut" } }
      }
    >
      {children}
    </motion.div>
  );
}

const TEAM = ["Ana Torres", "Diego Fernández", "Carlos Ruiz", "Sofía Navarro", "Laura Méndez"];

export function HeroCollage({ glowOpacity }: { glowOpacity?: MotionValue<number> }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="bg-grid absolute inset-0" />
      <motion.div
        style={{ opacity: glowOpacity }}
        className="absolute top-[-20%] left-1/2 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]"
      />

      {/* Solo en pantallas anchas: en las chicas no hay lugar a los costados del titular */}
      <div className="absolute inset-x-0 top-0 hidden h-[760px] xl:block">
        {/* ── Izquierda ── */}
        <Float className={`${CARD} top-[150px] left-[max(2%,calc(50%-680px))] w-56 -rotate-3`} delay={0.2}>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" /> Trabajando desde las 09:02
          </p>
          <p className="mt-1 font-mono text-[22px] font-medium tabular">04:21:37</p>
          <div className="mt-2 flex gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px]">
              <Coffee className="size-3" /> Pausar
            </span>
            <span className="rounded-lg bg-foreground px-2 py-1 text-[11px] text-background">Fichar salida</span>
          </div>
        </Float>

        <Float className={`${CARD} top-[360px] left-[max(5%,calc(50%-640px))] w-60 rotate-2`} delay={0.6}>
          <p className="flex items-center gap-1.5 text-[12px] font-medium">
            <Palmtree className="size-3.5 text-success" /> Vacaciones aprobadas
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Ana Torres · 26 – 30 oct · 5 días</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Avatar name="Carlos Ruiz" size={18} /> Aprobó Carlos Ruiz
          </div>
        </Float>

        <Float className={`${CARD} top-[560px] left-[max(1%,calc(50%-700px))] w-52 -rotate-2`} delay={1}>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="size-3.5" /> Equipo hoy
          </p>
          <div className="mt-2 flex -space-x-2">
            {TEAM.map((n) => (
              <Avatar key={n} name={n} size={26} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">4 trabajando · 1 de vacaciones</p>
        </Float>

        {/* ── Derecha ── */}
        <Float className={`${CARD} top-[130px] right-[max(2%,calc(50%-680px))] w-60 rotate-3`} delay={0.4}>
          <p className="text-[11px] text-muted-foreground">OT-0042 · Portal clientes</p>
          <p className="mt-0.5 text-[13px] font-medium">Octubre 2026</p>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>68 h de 90 h</span>
            <span className="text-foreground tabular">5.780 €</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted">
            <div className="h-full w-[76%] rounded-full bg-accent" />
          </div>
        </Float>

        <Float className={`${CARD} top-[340px] right-[max(1%,calc(50%-700px))] w-56 -rotate-2`} delay={0.8}>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="size-3.5" /> Horas esta semana
          </p>
          <div className="mt-2 flex h-14 items-end gap-1.5">
            {[62, 80, 74, 92, 55].map((h, i) => (
              <span key={i} className={`flex-1 rounded-t ${i === 3 ? "bg-accent" : "bg-accent/30"}`} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-1 flex text-[10px] text-muted-foreground">
            {["L", "M", "X", "J", "V"].map((d) => (
              <span key={d} className="flex-1 text-center">
                {d}
              </span>
            ))}
          </div>
        </Float>

        <Float className={`${CARD} top-[560px] right-[max(4%,calc(50%-650px))] w-56 rotate-2`} delay={1.2}>
          <p className="flex items-center gap-1.5 text-[12px] font-medium">
            <Receipt className="size-3.5 text-accent" /> OT-0039 facturada
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Septiembre · 4.675 € · Acme Corp</p>
        </Float>
      </div>

      {/* Zona de lectura: velo suave detrás del titular */}
      <div className="absolute top-[110px] left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-background opacity-70 blur-3xl" />
    </div>
  );
}
