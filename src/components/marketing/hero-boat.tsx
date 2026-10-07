"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Droplets, Fan, MousePointer2, Plug, Snowflake, Zap, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { EQUIPMENT, type EquipmentKey } from "./boat-model";

// WebGL solo en el cliente; mientras carga se ve el fondo de la carta
const BoatCanvas = dynamic(() => import("./boat-canvas"), { ssr: false });

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
function useFinePointer() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(FINE_POINTER);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(FINE_POINTER).matches,
    () => false,
  );
}

function ThrusterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 9h12l5 3-5 3H3z" />
      <path d="M9 9v6" />
      <path d="M6.5 5.5 9 9l2.5-3.5M6.5 18.5 9 15l2.5 3.5" />
    </svg>
  );
}

const ICONS: Record<EquipmentKey, LucideIcon | typeof ThrusterIcon> = {
  generator: Zap,
  battery: Plug,
  water: Droplets,
  ac: Fan,
  fridge: Snowflake,
  thruster: ThrusterIcon,
};

/**
 * Escenario del hero: el barco 3D en el centro, la ficha del equipo activo a la
 * izquierda y la lista de equipos a la derecha. Barco, ficha y lista se resaltan juntos.
 */
export function HeroBoat() {
  const fine = useFinePointer();
  const still = useReducedMotion();
  const [hovered, setHovered] = useState<EquipmentKey | null>(null);
  const [demo, setDemo] = useState(0);
  // Sin interacción, el barco va mostrando sus equipos de a uno
  useEffect(() => {
    if (hovered) return;
    const t = setInterval(() => setDemo((d) => (d + 1) % EQUIPMENT.length), 3200);
    return () => clearInterval(t);
  }, [hovered]);
  const active = hovered ?? EQUIPMENT[demo].id;
  const current = EQUIPMENT.find((e) => e.id === active)!;
  const Icon = ICONS[active];

  return (
    <div className="relative grid items-center gap-6 lg:grid-cols-[260px_1fr_220px]">
      {/* Ficha del equipo activo */}
      <div className="order-2 lg:order-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-blue-100 bg-white/85 p-5 shadow-[0_24px_60px_-34px_rgba(29,78,216,0.45)] backdrop-blur"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <p className="mt-4 text-[17px] font-semibold tracking-tight text-slate-900">{current.name}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{current.description}</p>
            <Link href="/#servicios" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 hover:underline hover:underline-offset-4">
              Ver servicio <ArrowRight className="size-3.5" />
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Barco */}
      <div className="order-1 lg:order-2">
        <div className="relative h-[300px] sm:h-[400px] lg:h-[440px]">
          <BoatCanvas active={active} onHover={setHovered} interactive={fine} autoRotate={!hovered && !still} />
        </div>
        {fine ? (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
            <MousePointer2 className="size-3.5" /> Arrastrá para girar el barco · pasá el mouse por un equipo
          </p>
        ) : null}
      </div>

      {/* Lista de equipos: también resalta el barco, con mouse o teclado */}
      <ul className="order-3 flex flex-wrap justify-center gap-1.5 lg:flex-col lg:gap-1" aria-label="Equipos que instalamos">
        {EQUIPMENT.map((e) => {
          const ItemIcon = ICONS[e.id];
          const on = active === e.id;
          return (
            <li key={e.id}>
              <button
                type="button"
                onPointerEnter={() => setHovered(e.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(e.id)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors",
                  on ? "bg-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(29,78,216,0.8)]" : "text-slate-600 hover:bg-blue-50 hover:text-slate-900",
                )}
              >
                <ItemIcon className={cn("size-4 shrink-0", on ? "text-white" : "text-blue-600")} strokeWidth={1.75} />
                {e.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
