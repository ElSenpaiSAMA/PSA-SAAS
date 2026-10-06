"use client";

import { motion, useReducedMotion, type MotionValue } from "motion/react";
import { Anchor, CalendarClock, CheckCircle2, Gauge, ReceiptText, Stethoscope } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";

// Fondo del hero: el día a día de los técnicos en tarjetas flotando a los costados del titular.
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

export function HeroCollage({ glowOpacity }: { glowOpacity?: MotionValue<number> }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="bg-grid absolute inset-0" />
      <motion.div
        style={{ opacity: glowOpacity }}
        className="absolute top-[-20%] left-1/2 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]"
      />

      {/* Olas al pie del hero */}
      <svg className="absolute inset-x-0 bottom-0 h-40 w-full text-accent" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path d="M0 90 C240 50 480 130 720 90 S1200 50 1440 90 V160 H0 Z" fill="currentColor" opacity="0.05" />
        <path d="M0 115 C260 85 500 150 760 115 S1220 85 1440 118 V160 H0 Z" fill="currentColor" opacity="0.07" />
      </svg>

      {/* Solo en pantallas anchas: en las chicas no hay lugar a los costados del titular */}
      <div className="absolute inset-x-0 top-0 hidden h-[760px] xl:block">
        {/* ── Izquierda ── */}
        <Float className={`${CARD} top-[150px] left-[max(2%,calc(50%-680px))] w-60 -rotate-3`} delay={0.2}>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Stethoscope className="size-3.5" /> Diagnóstico listo
          </p>
          <p className="mt-1 text-[13px] font-medium">Sunseeker 50 · generador no arranca</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Electroválvula de combustible sustituida</p>
        </Float>

        <Float className={`${CARD} top-[350px] left-[max(5%,calc(50%-640px))] w-60 rotate-2`} delay={0.6}>
          <p className="flex items-center gap-1.5 text-[12px] font-medium">
            <CheckCircle2 className="size-3.5 text-success" /> Aire acondicionado instalado
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Princess V58 · 3 unidades · 48.000 BTU</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Avatar name="Ana Torres" size={18} /> Ana Torres · climatización
          </div>
        </Float>

        <Float className={`${CARD} top-[560px] left-[max(1%,calc(50%-700px))] w-52 -rotate-2`} delay={1}>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Anchor className="size-3.5" /> Intervenciones hoy
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[1, 1, 1, 0].map((busy, i) => (
              <span key={i} className={`h-6 rounded-md ${busy ? "bg-accent/70" : "border border-dashed border-border"}`} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">3 técnicos a bordo · 1 en taller</p>
        </Float>

        {/* ── Derecha ── */}
        <Float className={`${CARD} top-[130px] right-[max(2%,calc(50%-680px))] w-60 rotate-3`} delay={0.4}>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ReceiptText className="size-3.5" /> Presupuesto cerrado
          </p>
          <p className="mt-0.5 text-[13px] font-medium">Potabilizadora 60 l/h</p>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Equipo + instalación</span>
            <span className="text-foreground tabular">4.380 €</span>
          </div>
        </Float>

        <Float className={`${CARD} top-[340px] right-[max(1%,calc(50%-700px))] w-56 -rotate-2`} delay={0.8}>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Gauge className="size-3.5" /> Avance de la reparación
          </p>
          <p className="mt-1 text-[13px] font-medium">Lagoon 46 · baterías de litio</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div className="h-full w-[72%] rounded-full bg-accent" />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Entrega prevista el viernes</p>
        </Float>

        <Float className={`${CARD} top-[560px] right-[max(4%,calc(50%-650px))] w-56 rotate-2`} delay={1.2}>
          <p className="flex items-center gap-1.5 text-[12px] font-medium">
            <CalendarClock className="size-3.5 text-accent" /> Próxima revisión
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Generador a las 500 h · aviso al propietario</p>
        </Float>
      </div>

      {/* Zona de lectura: velo suave detrás del titular */}
      <div className="absolute top-[110px] left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-background opacity-70 blur-3xl" />
    </div>
  );
}
