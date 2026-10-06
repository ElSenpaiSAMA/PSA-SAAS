"use client";

import { motion, useReducedMotion, type MotionValue } from "motion/react";

const R = 420;
const MERIDIANS = 8;
const PERIOD = 18; // segundos por media vuelta
const PARALLELS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];

const r2 = (n: number) => Math.round(n * 100) / 100;

// Proyección de un meridiano que gira: su semieje horizontal es R·|sin θ|.
// Muestreado en 24 pasos para que el movimiento siga la curva de una esfera real.
const SWEEP = Array.from({ length: 25 }, (_, k) => r2(R * Math.abs(Math.sin((Math.PI * k) / 24))));

/**
 * Fondo del hero: un globo de líneas que gira lento. Habla de equipos en
 * distintos husos horarios y de varias empresas en una misma plataforma.
 * Con "reducir movimiento" queda quieto.
 */
export function HeroGlobe({ opacity }: { opacity?: MotionValue<number> }) {
  const still = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      style={{ opacity }}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,black_45%,transparent_85%)]"
    >
      <div className="absolute top-[-10%] left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]" />
      <svg
        viewBox="-500 -500 1000 1000"
        className="absolute top-[2%] left-1/2 size-[640px] -translate-x-1/2 text-muted-foreground sm:top-[-6%] sm:size-[1000px]"
      >
        <circle r={R} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />

        {PARALLELS.map((f) => {
          const rx = r2(R * Math.sqrt(1 - f * f));
          return <ellipse key={f} cy={r2(f * R)} rx={rx} ry={r2(rx * 0.16)} fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.22" />;
        })}

        {Array.from({ length: MERIDIANS }, (_, i) => {
          const phase = i / MERIDIANS;
          const accent = i === 0;
          return (
            <motion.ellipse
              key={i}
              ry={R}
              fill="none"
              stroke={accent ? "var(--accent)" : "currentColor"}
              strokeWidth={accent ? 1.4 : 0.8}
              opacity={accent ? 0.7 : 0.28}
              // Pose inicial idéntica en servidor y cliente (sin depender del reloj)
              initial={{ rx: SWEEP[Math.round(phase * 24)] }}
              animate={still ? undefined : { rx: SWEEP }}
              transition={{ duration: PERIOD, delay: -phase * PERIOD, repeat: Infinity, ease: "linear" }}
            />
          );
        })}
      </svg>
    </motion.div>
  );
}
