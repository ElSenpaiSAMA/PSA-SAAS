import { Droplets, Fan, Plug, Snowflake, Zap } from "lucide-react";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { SpotlightCard } from "./spotlight-card";

// Propulsor de proa: no hay ícono equivalente en lucide, se dibuja uno simple
function ThrusterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 9h12l5 3-5 3H3z" />
      <path d="M9 9v6" />
      <path d="M6.5 5.5 9 9l2.5-3.5M6.5 18.5 9 15l2.5 3.5" />
    </svg>
  );
}

const SERVICES = [
  {
    icon: <Fan className="size-5" strokeWidth={1.75} />,
    title: "Aire acondicionado",
    text: "Diseño, instalación y mantenimiento de sistemas de climatización a bordo, a medida de cada embarcación.",
    items: ["Instalación a medida", "Mantenimiento", "Recarga y averías"],
  },
  {
    icon: <Snowflake className="size-5" strokeWidth={1.75} />,
    title: "Refrigeración",
    text: "Neveras, congeladores y cámaras frigoríficas: instalación nueva, reparación y puesta a punto.",
    items: ["Neveras y congeladores", "Compresores", "Puesta a punto"],
  },
  {
    icon: <Zap className="size-5" strokeWidth={1.75} />,
    title: "Generadores",
    text: "Instalación, revisiones por horas y reparación de generadores para que nunca te falte energía a bordo.",
    items: ["Revisiones por horas", "Reparación", "Instalación"],
  },
  {
    icon: <Droplets className="size-5" strokeWidth={1.75} />,
    title: "Potabilizadoras",
    text: "Generadores de agua dulce por ósmosis inversa: instalación, cambio de membranas y mantenimiento.",
    items: ["Ósmosis inversa", "Membranas y filtros", "Invernaje"],
  },
  {
    icon: <Plug className="size-5" strokeWidth={1.75} />,
    title: "Sistemas eléctricos",
    text: "Baterías, cargadores, inversores, cuadros y cableado, con material marino y proyectos a medida.",
    items: ["Baterías y cargadores", "Inversores", "Cuadros y cableado"],
  },
  {
    icon: <ThrusterIcon className="size-5" />,
    title: "Hélices de proa",
    text: "Instalación y reparación de propulsores de proa y popa para maniobrar con precisión en puerto.",
    items: ["Proa y popa", "Instalación", "Reparación"],
  },
];

export function Services() {
  return (
    <section
      id="servicios"
      className="relative z-10 scroll-mt-24 bg-[linear-gradient(180deg,transparent_0%,transparent_35%,#f5f9ff_100%)] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <RevealItem>
            <p className="text-[13px] font-medium text-blue-700">Servicios</p>
          </RevealItem>
          <RevealItem>
            <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance text-slate-950">
              Energía, clima y agua a bordo,{" "}
              <span className="font-serif font-normal text-blue-700 italic">resueltos por especialistas.</span>
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-600">
              Instalamos, reparamos y mantenemos los equipos eléctricos y de confort de yates y embarcaciones, con proyectos a medida y
              tecnología de punta.
            </p>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
          {SERVICES.map(({ icon, title, text, items }) => (
            <RevealItem key={title} className="h-full">
              <SpotlightCard className="h-full border-blue-100/80 bg-white p-6 shadow-[0_18px_40px_-34px_rgba(29,78,216,0.5)]">
                <div className="relative">
                  <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</div>
                  <h3 className="text-[17px] font-semibold tracking-tight text-slate-950">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{text}</p>
                  <ul className="mt-5 flex flex-wrap gap-1.5">
                    {items.map((i) => (
                      <li key={i} className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] text-blue-800/80">
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              </SpotlightCard>
            </RevealItem>
          ))}
        </Reveal>

        {/* ElectroMotor: la otra línea de la empresa */}
        <Reveal className="mt-4">
          <RevealItem>
            <div className="flex flex-col gap-4 rounded-3xl bg-[linear-gradient(120deg,#0b1f3a,#123a6b)] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="text-[12.5px] font-medium text-sky-300">También en el grupo</p>
                <h3 className="mt-1 text-[22px] font-semibold tracking-tight">ElectroMotor</h3>
                <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-white/70">
                  Taller propio de reparación de motores de arranque, alternadores y dinamos, para barcos y también para otros vehículos.
                </p>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {["Motores de arranque", "Alternadores", "Dinamos"].map((i) => (
                  <li key={i} className="rounded-full bg-white/10 px-3 py-1 text-[12.5px] text-white/85">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
