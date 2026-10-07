"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Fondo del hero: carta náutica frente al taller (Sant Adrià de Besòs). Decorativo y
// determinista: todas las curvas salen de fórmulas fijas y se redondean, para que el
// SVG del servidor y el del cliente coincidan al hidratar.

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Curva de nivel (isobata): un óvalo deformado con senos, distinto en cada nivel. */
function contour(cx: number, cy: number, r: number, i: number) {
  const pts: string[] = [];
  for (let k = 0; k <= 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const rr = r * (1 + 0.09 * Math.sin(3 * a + i * 0.7) + 0.05 * Math.cos(5 * a - i * 0.4));
    pts.push(`${r1(cx + rr * Math.cos(a) * 1.5)} ${r1(cy + rr * Math.sin(a))}`);
  }
  return `M${pts.join(" L")} Z`;
}

// Sondas (profundidad en metros) repartidas por la carta
const DEPTHS = [
  [90, 210, "21"],
  [300, 860, "18"],
  [560, 840, "25"],
  [900, 860, "31"],
  [1340, 280, "9"],
  [1390, 640, "14"],
  [880, 120, "6"],
  [1130, 110, "4"],
  [40, 470, "12"],
] as const;

function Compass() {
  return (
    <g transform="translate(1340 160) scale(0.5)" className="fill-none stroke-blue-600" opacity="0.5">
      <circle r="92" />
      <circle r="80" strokeOpacity="0.6" />
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        const len = i % 8 === 0 ? 14 : i % 4 === 0 ? 9 : 5;
        return (
          <line
            key={i}
            x1={r1(Math.cos(a) * 80)}
            y1={r1(Math.sin(a) * 80)}
            x2={r1(Math.cos(a) * (80 - len))}
            y2={r1(Math.sin(a) * (80 - len))}
          />
        );
      })}
      <path d="M0 -70 L10 0 L0 70 L-10 0 Z M-70 0 L0 -10 L70 0 L0 10 Z" className="fill-blue-600/10" />
      <text y="-100" className="fill-blue-700 stroke-none font-serif" fontSize="18" textAnchor="middle">
        N
      </text>
    </g>
  );
}

/** Cuánto sigue la carta por debajo de la sección cuando se funde con la siguiente. */
const FLOW = "28rem";

/**
 * @param flowInto Las curvas no terminan en el borde de la sección: siguen por debajo,
 * dentro de la sección siguiente, y se desvanecen de a poco (sin corte ni regla al pie).
 */
export function ChartBackground({ flowInto = false }: { flowInto?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden",
        flowInto
          ? "bg-[linear-gradient(180deg,#e6f0fc_0%,#f4f8fe_40%,#ffffff_70%)]"
          : "bottom-0 bg-[linear-gradient(180deg,#e6f0fc_0%,#f4f8fe_45%,#ffffff_100%)]",
      )}
      // La carta se ve entera hasta el borde de la sección y se desvanece en la extensión
      style={
        flowInto ? { bottom: `-${FLOW}`, maskImage: `linear-gradient(180deg, #000 calc(100% - ${FLOW}), transparent 100%)` } : undefined
      }
    >
      <svg
        className="absolute inset-x-0 top-0 w-full overflow-visible"
        style={{ height: flowInto ? `calc(100% - ${FLOW})` : "100%" }}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        {flowInto
          ? // Más curvas hacia abajo, para que la carta siga dentro de la sección siguiente
            Array.from({ length: 7 }, (_, i) => (
              <path
                key={`c${i}`}
                d={contour(260, 1320, 120 + i * 60, i + 5)}
                className="fill-none stroke-blue-500"
                strokeOpacity={i % 3 === 0 ? 0.26 : 0.14}
              />
            ))
          : null}
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={`a${i}`}
            d={contour(1180, 1000, 60 + i * 55, i)}
            className="fill-none stroke-blue-500"
            strokeOpacity={i % 3 === 0 ? 0.32 : 0.16}
          />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <path key={`b${i}`} d={contour(120, -40, 50 + i * 50, i + 3)} className="fill-none stroke-blue-500" strokeOpacity="0.2" />
        ))}
        {DEPTHS.map(([x, y, d]) => (
          <text key={`${x}-${y}`} x={x} y={y} className="fill-blue-600/55 font-serif" fontSize="15" fontStyle="italic">
            {d}
          </text>
        ))}
        {/* Derrota: se traza al cargar */}
        <motion.path
          d="M40 860 C240 840 380 800 560 812 C740 824 820 870 1000 850 C1180 830 1280 760 1400 700"
          className="fill-none stroke-blue-600"
          strokeWidth="1.8"
          strokeOpacity="0.7"
          strokeDasharray="1 0"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.6, duration: 3.5, ease: "easeInOut" }}
        />
        <circle cx="40" cy="860" r="5" className="fill-none stroke-blue-600" strokeWidth="2" />
        <circle cx="1400" cy="700" r="5" className="fill-blue-600" />
        <Compass />
        {/* Graduación del borde inferior (solo cuando la carta termina en la sección) */}
        {flowInto
          ? null
          : Array.from({ length: 49 }, (_, i) => (
              <line
                key={`t${i}`}
                x1={i * 30}
                y1="900"
                x2={i * 30}
                y2={i % 5 === 0 ? 884 : 892}
                className="stroke-blue-900"
                strokeOpacity="0.3"
              />
            ))}
      </svg>
      <div
        className="absolute inset-x-0 mx-auto hidden max-w-6xl justify-between px-6 font-mono text-[11px] tracking-wider text-blue-900/50 md:flex"
        style={{ bottom: flowInto ? `calc(${FLOW} + 1.25rem)` : "1.25rem" }}
      >
        <span>41°25′N · 2°13′E</span>
        <span>SANT ADRIÀ DE BESÒS · BARCELONA</span>
        <span>SONDAS EN METROS</span>
      </div>
    </div>
  );
}
