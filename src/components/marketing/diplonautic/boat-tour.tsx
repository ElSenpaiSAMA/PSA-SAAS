"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, MousePointerClick } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BOAT_SERVICES, type BoatServiceId } from "./content";

// Recorrido por dentro del barco: un corte lateral del yate, dibujado como un plano y
// siempre entero. Cada equipo tiene un punto para elegirlo (o se elige en las pestañas);
// el elegido se ilumina con lo que hace y debajo aparece su ficha. Sin interacción, el
// recorrido avanza solo de popa a proa. El plano usa un viewBox de 2400 × 800.

const EASE = [0.16, 1, 0.3, 1] as const;
const W = 2400;

type Room = "maquinas" | "tecnico" | "salon" | "cocina" | "camarotes" | "proa";

interface Stop {
  service: BoatServiceId;
  room: string;
  rooms: Room[];
  /** Dónde va el punto para elegir el equipo */
  spot: [number, number];
}

export const TOUR: Stop[] = [
  { service: "generadores", room: "Sala de máquinas", rooms: ["maquinas"], spot: [388, 484] },
  { service: "electricos", room: "Sala de máquinas", rooms: ["maquinas"], spot: [612, 478] },
  { service: "potabilizadoras", room: "Cuarto técnico", rooms: ["tecnico"], spot: [975, 484] },
  { service: "aire", room: "Salón y camarotes", rooms: ["salon", "camarotes"], spot: [1278, 545] },
  { service: "refrigeracion", room: "Cocina", rooms: ["cocina"], spot: [1515, 330] },
  { service: "helices", room: "Proa", rooms: ["proa"], spot: [2040, 562] },
];

/** Encuadre del barco entero, con un poco de mar y sin márgenes vacíos */
const VIEW = `90 90 ${W - 140} 640`;

export function BoatTour() {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const visible = useInView(ref, { amount: 0.4 });
  const [stop, setStop] = useState(0);
  const [touched, setTouched] = useState(false);

  // Mientras está a la vista y nadie lo toca, avanza solo
  useEffect(() => {
    if (touched || still || !visible) return;
    const t = setInterval(() => setStop((s) => (s + 1) % TOUR.length), 6000);
    return () => clearInterval(t);
  }, [touched, still, visible]);

  const pick = (i: number) => {
    setTouched(true);
    setStop(i);
  };

  const current = TOUR[stop];
  const service = BOAT_SERVICES.find((s) => s.id === current.service)!;
  const next = TOUR[(stop + 1) % TOUR.length];
  const nextService = BOAT_SERVICES.find((s) => s.id === next.service)!;

  return (
    <div ref={ref}>
      {/* Pestañas: de popa a proa */}
      <div role="tablist" aria-label="Equipos del barco" className="flex flex-wrap gap-1.5">
        {TOUR.map((t, i) => {
          const s = BOAT_SERVICES.find((x) => x.id === t.service)!;
          return (
            <button
              key={t.service}
              type="button"
              role="tab"
              aria-selected={i === stop}
              onClick={() => pick(i)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                i === stop
                  ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(29,78,216,0.8)]"
                  : "border-blue-100 bg-white text-slate-600 hover:border-blue-300 hover:text-slate-900",
              )}
            >
              <span className="font-mono text-[10.5px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </button>
          );
        })}
      </div>

      {/* El plano, entero */}
      <div className="relative mt-6 overflow-hidden rounded-3xl border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8fe_100%)] px-2 pt-4 sm:px-6">
        <svg viewBox={VIEW} className="block h-auto w-full" role="img" aria-label={`Corte lateral de un yate. Equipo elegido: ${service.title}, en ${current.room.toLowerCase()}`}>
          <BoatDrawing active={current} />
          {TOUR.map((t, i) => (
            <Hotspot key={t.service} at={t.spot} on={i === stop} label={BOAT_SERVICES.find((s) => s.id === t.service)!.title} onPick={() => pick(i)} />
          ))}
        </svg>
        <p className="pointer-events-none absolute top-4 right-5 hidden items-center gap-1.5 text-[12px] text-slate-500 sm:flex">
          <MousePointerClick className="size-3.5" /> Tocá un punto para ver cada equipo
        </p>
      </div>

      {/* Ficha del equipo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={service.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-4 grid overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_24px_60px_-34px_rgba(11,31,58,0.45)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[320px]">
            <Image src={service.photo} alt={service.title} fill sizes="(min-width: 768px) 520px, 100vw" className="object-cover" />
          </div>
          <div className="flex flex-col p-6 sm:p-8">
            <p className="font-mono text-[11.5px] tracking-wider text-blue-700 uppercase">
              {String(stop + 1).padStart(2, "0")} / {String(TOUR.length).padStart(2, "0")} · {current.room}
            </p>
            <h3 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-slate-950">{service.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{service.summary}</p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {service.checks.map((c) => (
                <li key={c} className="flex gap-2 text-[14px] leading-snug text-slate-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-blue-600" strokeWidth={2.25} /> {c}
                </li>
              ))}
            </ul>
            {service.brands.length > 0 ? (
              <div className="mt-5">
                <p className="text-[11px] font-medium tracking-[0.18em] text-blue-700 uppercase">Trabajamos con</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {service.brands.map((b) => (
                    <li key={b} className="rounded-full border border-blue-100 bg-[#f4f8fe] px-3 py-1 text-[12.5px] text-slate-700">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-7">
              <Link
                href={`/contacto?servicio=${service.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-[14px] font-medium text-white transition-colors hover:bg-blue-500"
              >
                Pedir presupuesto <ArrowRight className="size-4" />
              </Link>
              <button type="button" onClick={() => pick((stop + 1) % TOUR.length)} className="group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-blue-700">
                Siguiente: {nextService.title}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Punto para elegir un equipo: late suave y, al pasar el mouse, muestra su nombre. */
function Hotspot({ at: [x, y], on, label, onPick }: { at: [number, number]; on: boolean; label: string; onPick: () => void }) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className="group cursor-pointer outline-none"
    >
      <motion.circle
        cx={x}
        cy={y}
        fill="none"
        stroke="#2563eb"
        strokeWidth="3"
        initial={false}
        animate={{ r: [18, 42], opacity: [0.6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
      />
      <circle cx={x} cy={y} r="18" fill={on ? "#2563eb" : "#ffffff"} stroke="#2563eb" strokeWidth="4" className="transition-colors" />
      <circle cx={x} cy={y} r="6" fill={on ? "#ffffff" : "#2563eb"} />
      <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <rect x={x - 140} y={y - 80} width="280" height="44" rx="22" fill="#0b1f3a" />
        <text x={x} y={y - 51} textAnchor="middle" fontSize="22" fill="#ffffff" fontFamily="var(--font-sans, ui-sans-serif, system-ui)">
          {label}
        </text>
      </g>
    </g>
  );
}

// ── El dibujo ─────────────────────────────────────────────────────────────────

const HULL = "M150 420 L185 585 C 700 668, 1580 662, 2060 586 C 2190 560, 2280 486, 2345 392 L 150 420 Z";
const NAVY = "#0b1f3a";
const LINE = "#1e3a8a";

const ROOMS: Record<Room, { x: number; y: number; w: number; h: number; label: string }> = {
  maquinas: { x: 190, y: 428, w: 520, h: 210, label: "SALA DE MÁQUINAS" },
  tecnico: { x: 710, y: 428, w: 360, h: 225, label: "CUARTO TÉCNICO" },
  camarotes: { x: 1070, y: 428, w: 700, h: 225, label: "CAMAROTES" },
  proa: { x: 1770, y: 410, w: 560, h: 200, label: "PROA" },
  salon: { x: 470, y: 262, w: 730, h: 150, label: "SALÓN" },
  cocina: { x: 1200, y: 262, w: 360, h: 150, label: "COCINA" },
};

function BoatDrawing({ active }: { active: Stop | null }) {
  const on = (r: Room) => !!active?.rooms.includes(r);
  const is = (s: BoatServiceId) => active?.service === s;

  return (
    <g fontFamily="var(--font-mono, ui-monospace, monospace)">
      <defs>
        <clipPath id="tour-hull">
          <path d={HULL} />
        </clipPath>
        <linearGradient id="tour-sea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" stopOpacity="0.55" />
          <stop offset="1" stopColor="#dbeafe" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Mar */}
      <rect x="-200" y="560" width={W + 400} height="300" fill="url(#tour-sea)" />
      <Waves />

      {/* Superestructura y flybridge */}
      <path d="M420 420 L470 255 L1640 255 Q1800 262 1905 405 Z" fill="#ffffff" stroke={LINE} strokeWidth="3" />
      <path d="M640 255 L700 168 L1340 168 L1420 255 Z" fill="#ffffff" stroke={LINE} strokeWidth="3" />
      <path d="M760 168 L800 110 L880 110 L900 168" fill="none" stroke={LINE} strokeWidth="3" />
      {/* Ventanas del salón y del puesto de mando */}
      {[560, 730, 900, 1070].map((x) => (
        <rect key={x} x={x} y="282" width="130" height="38" rx="10" fill={NAVY} opacity="0.85" />
      ))}
      <path d="M1600 282 L1700 282 Q1760 290 1800 330 L1600 330 Z" fill={NAVY} opacity="0.85" />
      <rect x="740" y="190" width="520" height="34" rx="10" fill={NAVY} opacity="0.75" />

      {/* Casco */}
      <path d={HULL} fill="#f8fbff" stroke={LINE} strokeWidth="3.5" />
      <g clipPath="url(#tour-hull)">
        {/* Línea de flotación pintada */}
        <path d="M150 548 C 700 600, 1600 600, 2400 520 L2400 800 L150 800 Z" fill="#dbeafe" opacity="0.55" />
      </g>
      {/* Ojos de buey */}
      {[1330, 1450, 1570, 1690].map((x) => (
        <circle key={x} cx={x} cy="470" r="11" fill="#ffffff" stroke={LINE} strokeWidth="2.5" />
      ))}

      {/* Ambientes */}
      <g clipPath="url(#tour-hull)">
        {(["maquinas", "tecnico", "camarotes", "proa"] as Room[]).map((r) => (
          <RoomBox key={r} room={r} on={on(r)} dim={!!active && !on(r)} />
        ))}
      </g>
      {(["salon", "cocina"] as Room[]).map((r) => (
        <RoomBox key={r} room={r} on={on(r)} dim={!!active && !on(r)} />
      ))}

      {/* Equipos */}
      <Generator on={is("generadores")} />
      <Batteries on={is("electricos") || is("generadores")} strong={is("electricos")} />
      <Watermaker on={is("potabilizadoras")} />
      <AirConditioning on={is("aire")} />
      <Fridge on={is("refrigeracion")} />
      <Thruster on={is("helices")} />
    </g>
  );
}

function RoomBox({ room, on, dim }: { room: Room; on: boolean; dim: boolean }) {
  const r = ROOMS[room];
  return (
    <g opacity={dim ? 0.45 : 1} style={{ transition: "opacity .6s" }}>
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill={on ? "#dbeafe" : "transparent"}
        stroke={on ? "#2563eb" : "#93c5fd"}
        strokeWidth={on ? 3 : 1.5}
        strokeDasharray={on ? undefined : "8 8"}
        style={{ transition: "fill .6s, stroke .6s" }}
      />
      {/* Camarotes va a la derecha: a la izquierda sube el conducto del aire */}
      <text
        x={room === "camarotes" ? r.x + r.w - 16 : r.x + 16}
        y={room === "salon" || room === "cocina" ? r.y + r.h - 16 : r.y + 30}
        textAnchor={room === "camarotes" ? "end" : "start"}
        fontSize="22"
        letterSpacing="3"
        fill={on ? "#1d4ed8" : "#64748b"}
      >
        {r.label}
      </text>
    </g>
  );
}

/** Línea animada que muestra algo que circula (energía, agua, aire). */
function Flow({ d, on, color, width = 5, speed = 1.2 }: { d: string; on: boolean; color: string; width?: number; speed?: number }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray="14 18"
      initial={false}
      animate={{ opacity: on ? 1 : 0, strokeDashoffset: on ? [0, -64] : 0 }}
      transition={{ opacity: { duration: 0.5 }, strokeDashoffset: { duration: speed, ease: "linear", repeat: Infinity } }}
    />
  );
}

function Equip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <g style={{ transition: "opacity .6s" }} opacity={on ? 1 : 0.75}>
      {children}
    </g>
  );
}

const fill = (on: boolean) => (on ? "#2563eb" : "#94a3b8");

function Generator({ on }: { on: boolean }) {
  return (
    <Equip on={on}>
      <rect x="220" y="505" width="150" height="60" rx="8" fill={fill(on)} />
      <circle cx="392" cy="535" r="26" fill={on ? "#1d4ed8" : "#64748b"} />
      <text x="220" y="492" fontSize="20" letterSpacing="2" fill="#334155">GENERADOR</text>
      {/* Energía: del generador a las baterías y al cuadro */}
      <Flow on={on} color="#f59e0b" d="M420 535 L462 535" />
      <Flow on={on} color="#f59e0b" d="M657 500 L657 440 L657 420" />
    </Equip>
  );
}

function Batteries({ on, strong }: { on: boolean; strong: boolean }) {
  return (
    <Equip on={on}>
      {[470, 505, 540, 575].map((x, i) => (
        <g key={x}>
          <rect x={x} y="510" width="28" height="60" rx="4" fill={strong ? NAVY : "#475569"} />
          <motion.rect
            x={x + 6}
            width="16"
            rx="2"
            fill="#38bdf8"
            initial={false}
            animate={strong ? { height: [6, 50, 50], y: [562, 516, 516] } : { height: 26, y: 540 }}
            transition={strong ? { duration: 2.4, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
          />
        </g>
      ))}
      {/* Inversor y cuadro */}
      <rect x="630" y="500" width="55" height="60" rx="6" fill={strong ? "#2563eb" : "#94a3b8"} />
      <text x="470" y="498" fontSize="20" letterSpacing="2" fill="#334155">BATERÍAS</text>
      <Flow on={strong} color="#facc15" d="M685 530 L720 530 L720 445 L1190 445 L1190 410" width={4} />
      <Flow on={strong} color="#facc15" d="M685 555 L1100 598 L1800 588 L2060 560" width={4} speed={1.6} />
    </Equip>
  );
}

function Watermaker({ on }: { on: boolean }) {
  return (
    <Equip on={on}>
      {/* Membrana y tanque */}
      <rect x="740" y="505" width="240" height="28" rx="14" fill={on ? "#ffffff" : "#e2e8f0"} stroke={on ? "#2563eb" : "#94a3b8"} strokeWidth="3" />
      <rect x="770" y="548" width="190" height="60" rx="8" fill="#ffffff" stroke={on ? "#0891b2" : "#94a3b8"} strokeWidth="3" />
      <motion.rect
        x="774"
        width="182"
        rx="6"
        fill="#22d3ee"
        initial={false}
        animate={on ? { height: [6, 52], y: [602, 552] } : { height: 18, y: 586 }}
        transition={on ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
        opacity={0.8}
      />
      <text x="740" y="492" fontSize="20" letterSpacing="2" fill="#334155">POTABILIZADORA</text>
      {/* Agua de mar que entra, y agua dulce que sube a la cocina */}
      <Flow on={on} color="#1e40af" d="M728 680 L728 519 L740 519" />
      <Flow on={on} color="#06b6d4" d="M980 519 L1030 519 L1030 390 L1325 390 L1325 372" speed={1.6} />
    </Equip>
  );
}

function AirConditioning({ on }: { on: boolean }) {
  const duct = "M1195 545 L1195 272 L500 272";
  return (
    <Equip on={on}>
      <rect x="1150" y="545" width="90" height="55" rx="8" fill={fill(on)} />
      <text x="1250" y="592" fontSize="20" letterSpacing="2" fill="#334155">AIRE ACONDICIONADO</text>
      <path d={duct} fill="none" stroke={on ? "#93c5fd" : "#cbd5e1"} strokeWidth="14" strokeLinecap="round" opacity="0.6" />
      <Flow on={on} color="#0ea5e9" d={duct} width={5} speed={1} />
      {/* Rejillas: el aire baja al salón y a los camarotes */}
      {[620, 820, 1000].map((x) => (
        <Flow key={x} on={on} color="#7dd3fc" d={`M${x} 282 L${x} 360`} width={4} speed={0.9} />
      ))}
      <Flow on={on} color="#7dd3fc" d="M1195 505 L1450 505 L1720 505" width={4} speed={1.2} />
    </Equip>
  );
}

function Fridge({ on }: { on: boolean }) {
  return (
    <Equip on={on}>
      <rect x="1400" y="300" width="80" height="108" rx="6" fill={on ? "#ffffff" : "#e2e8f0"} stroke={on ? "#2563eb" : "#94a3b8"} strokeWidth="3" />
      <line x1="1400" y1="345" x2="1480" y2="345" stroke={on ? "#2563eb" : "#94a3b8"} strokeWidth="3" />
      {/* Encimera y fregadero */}
      <rect x="1270" y="350" width="110" height="22" rx="4" fill="#cbd5e1" />
      <text x="1400" y="292" fontSize="20" letterSpacing="2" fill="#334155">NEVERA</text>
      {/* Frío: escarcha que se mueve dentro de la nevera */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.circle
          key={i}
          r="4"
          fill="#22d3ee"
          initial={false}
          animate={on ? { cx: [1415 + i * 12, 1465 - i * 8, 1415 + i * 12], cy: [395, 315 + i * 6, 395], opacity: [0, 1, 0] } : { opacity: 0 }}
          transition={{ duration: 2.4, delay: i * 0.35, repeat: on ? Infinity : 0 }}
        />
      ))}
    </Equip>
  );
}

function Thruster({ on }: { on: boolean }) {
  return (
    <Equip on={on}>
      <circle cx="2110" cy="560" r="30" fill="#ffffff" stroke={fill(on)} strokeWidth="6" />
      <g transform="translate(2110 560)">
        <motion.g
          initial={false}
          animate={on ? { rotate: 360 } : { rotate: 0 }}
          transition={on ? { duration: 0.8, ease: "linear", repeat: Infinity } : { duration: 0.3 }}
        >
          {[0, 90, 180, 270].map((a) => (
            <ellipse key={a} cx="0" cy="-14" rx="6" ry="13" fill={on ? "#c2814f" : "#94a3b8"} transform={`rotate(${a})`} />
          ))}
        </motion.g>
      </g>
      <rect x="2096" y="470" width="28" height="60" rx="6" fill={fill(on)} />
      <text x="2040" y="455" fontSize="20" letterSpacing="2" fill="#334155">HÉLICE DE PROA</text>
      {/* El empuje: ondas que salen del túnel */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx="2110"
          cy="560"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          initial={false}
          animate={on ? { r: [32, 120], opacity: [0.7, 0] } : { r: 32, opacity: 0 }}
          transition={{ duration: 1.8, delay: i * 0.6, repeat: on ? Infinity : 0, ease: "easeOut" }}
        />
      ))}
    </Equip>
  );
}

function Waves() {
  return (
    <motion.path
      d="M-200 560 Q -100 545 0 560 T 200 560 T 400 560 T 600 560 T 800 560 T 1000 560 T 1200 560 T 1400 560 T 1600 560 T 1800 560 T 2000 560 T 2200 560 T 2400 560 T 2600 560"
      fill="none"
      stroke="#60a5fa"
      strokeWidth="3"
      animate={{ x: [0, -200] }}
      transition={{ duration: 6, ease: "linear", repeat: Infinity }}
    />
  );
}
