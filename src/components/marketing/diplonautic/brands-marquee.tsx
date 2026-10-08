"use client";

import { motion, useReducedMotion } from "motion/react";
import { BOAT_SERVICES } from "./content";

const BRANDS = [...new Set(BOAT_SERVICES.flatMap((s) => s.brands))];

/** Cinta de marcas que se desplaza sola, con los bordes desvanecidos. */
export function BrandsMarquee() {
  const still = useReducedMotion();
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={hidden}>
      {BRANDS.map((b) => (
        <li key={b} className="text-[clamp(1.1rem,2vw,1.5rem)] font-semibold tracking-tight whitespace-nowrap text-slate-400">
          {b}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <motion.div
        className="flex w-max"
        animate={still ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 45, ease: "linear", repeat: Infinity }}
      >
        {row(false)}
        {row(true)}
      </motion.div>
    </div>
  );
}
