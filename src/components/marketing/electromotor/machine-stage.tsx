"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Cog, Droplets, Gauge, MousePointer2, Power, Wrench, Zap } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ELECTRO_SERVICES, type ElectroIcon } from "@/components/marketing/electromotor/content";
import { cn } from "@/lib/utils";
import { MACHINES, type MachineId } from "./machine-model";

// WebGL solo en el cliente
const MachineCanvas = dynamic(() => import("./machine-canvas"), { ssr: false });

const ICON: Record<ElectroIcon, typeof Zap> = { starter: Power, alternator: Zap, dynamo: Gauge, motor: Cog, pump: Droplets };
const EASE = [0.16, 1, 0.3, 1] as const;

/** Fotos reales de cada equipo (public/motores) */
const PHOTO: Record<MachineId, string> = {
  arranque: "/motores/motor-arranque.jpg",
  alternadores: "/motores/alternador.jpg",
  dinamos: "/motores/dinamo.jpg",
  motores: "/motores/motor-electrico.jpg",
  bombas: "/motores/bomba.jpg",
};

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

/**
 * El taller en 3D: elegís un equipo, se arma sobre el banco de pruebas y se puede
 * desmontar para ver cada pieza que revisamos. Ficha, equipo y piezas se resaltan juntos.
 */
export function MachineStage() {
  const fine = useFinePointer();
  const still = useReducedMotion();
  const [machine, setMachine] = useState<MachineId>("alternadores");
  const [hovered, setHovered] = useState<string | null>(null);
  const [manual, setManual] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const parts = MACHINES[machine];

  // Demo mientras nadie lo toque: armado → se desmonta → recorre las piezas → se vuelve a armar
  const cycle = parts.length + 4;
  useEffect(() => {
    if (manual !== null || hovered || still) return;
    const t = setInterval(() => setTick((n) => n + 1), 1100);
    return () => clearInterval(t);
  }, [manual, hovered, still]);
  const step = tick % cycle;
  const demoExploded = step >= 2 && step < cycle - 1;
  const demoPart = step >= 3 && step < 3 + parts.length ? parts[step - 3].key : null;
  const exploded = manual ?? (still ? false : demoExploded);
  const part = hovered ?? (manual === null ? demoPart : null);

  const service = ELECTRO_SERVICES.find((s) => s.id === machine)!;
  const Icon = ICON[service.icon];
  const setPart = setHovered;

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[270px_1fr_210px]">
      {/* Ficha del equipo: lo que hacemos */}
      <div className="order-2 lg:order-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={machine}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="rounded-3xl border border-blue-100 bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(29,78,216,0.45)] backdrop-blur"
          >
            <div className="relative -mx-1 -mt-1 h-36 overflow-hidden rounded-2xl bg-white">
              <Image src={PHOTO[machine]} alt={`${service.title}: así llega al taller`} fill sizes="270px" className="object-contain p-2" />
              <span className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
            </div>
            <p className="mt-3 text-[17px] font-semibold tracking-tight text-slate-900">{service.title}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{service.summary}</p>
            <p className="mt-4 text-[11px] font-medium tracking-[0.18em] text-blue-700 uppercase">Qué hacemos</p>
            <ul className="mt-2 grid gap-1.5">
              {service.checks.map((c) => (
                <li key={c} className="flex gap-2 text-[13px] leading-snug text-slate-700">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-blue-600" strokeWidth={2.25} /> {c}
                </li>
              ))}
            </ul>
            <Link
              href="/contacto?servicio=electromotor"
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 hover:underline hover:underline-offset-4"
            >
              Pedir presupuesto <ArrowRight className="size-3.5" />
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Equipo en 3D sobre el banco */}
      <div className="order-1 lg:order-2">
        <div className="relative h-[320px] sm:h-[420px] lg:h-[460px]">
          <MachineCanvas id={machine} active={part} exploded={exploded} onHover={setPart} interactive={fine} autoRotate={!part && !still} />
          <button
            type="button"
            onClick={() => {
              setManual(!exploded);
            }}
            className="absolute bottom-3 left-1/2 inline-flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 text-[13px] font-medium text-white shadow-lg transition-colors hover:bg-blue-700"
          >
            <Wrench className="size-4" /> {exploded ? "Volver a montar" : "Desmontar"}
          </button>
        </div>
        {/* Piezas: resaltan el modelo con mouse o teclado */}
        <ul className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Piezas que revisamos">
          {parts.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onPointerEnter={() => setPart(p.key)}
                onPointerLeave={() => setPart(null)}
                onFocus={() => setPart(p.key)}
                onBlur={() => setPart(null)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                  part === p.key ? "border-blue-600 bg-blue-600 text-white" : "border-blue-100 bg-white/80 text-slate-600 hover:border-blue-300",
                )}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        {fine ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
            <MousePointer2 className="size-3.5" /> Arrastrá para girarlo · pasá el mouse por una pieza
          </p>
        ) : null}
      </div>

      {/* Equipos que reparamos */}
      <ul role="tablist" aria-label="Equipos que reparamos" className="order-3 flex flex-wrap justify-center gap-1.5 lg:flex-col lg:gap-1">
        {ELECTRO_SERVICES.map((s) => {
          const ItemIcon = ICON[s.icon];
          const on = s.id === machine;
          return (
            <li key={s.id}>
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setMachine(s.id as MachineId);
                  setHovered(null);
                  setManual(null);
                  setTick(0);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors",
                  on ? "bg-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(29,78,216,0.8)]" : "text-slate-600 hover:bg-blue-50 hover:text-slate-900",
                )}
              >
                <ItemIcon className={cn("size-4 shrink-0", on ? "text-white" : "text-blue-600")} strokeWidth={1.75} />
                {s.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
