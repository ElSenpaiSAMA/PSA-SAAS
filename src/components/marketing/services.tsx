import { Anchor, Cog, Paintbrush, Radar, Sailboat, Zap } from "lucide-react";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { SpotlightCard } from "./spotlight-card";

const SERVICES = [
  {
    icon: Cog,
    title: "Mecánica y motores",
    text: "Revisiones de horas, reparación de motores intraborda y fueraborda, transmisiones, ejes y hélices.",
    items: ["Mantenimiento por horas", "Colas y saildrives", "Refrigeración e inyección"],
  },
  {
    icon: Zap,
    title: "Electricidad a bordo",
    text: "Baterías, carga, alternadores, cuadros eléctricos y energía solar, con material marino certificado.",
    items: ["Baterías de litio", "Placas solares", "Cuadros y cableado"],
  },
  {
    icon: Radar,
    title: "Electrónica y navegación",
    text: "Instalación y diagnóstico de plotters, radar, AIS, pilotos automáticos y comunicaciones.",
    items: ["Plotter y radar", "Piloto automático", "VHF y AIS"],
  },
  {
    icon: Paintbrush,
    title: "Pintura y antifouling",
    text: "Limpieza de casco, antifouling, tratamiento de ósmosis, gelcoat y pulido para que luzca como nuevo.",
    items: ["Antifouling anual", "Reparación de gelcoat", "Tratamiento de ósmosis"],
  },
  {
    icon: Sailboat,
    title: "Jarcia y velas",
    text: "Revisión de jarcia fija y de labor, sustitución de cabos y puesta a punto de enrolladores.",
    items: ["Jarcia fija", "Enrolladores", "Cabos y poleas"],
  },
  {
    icon: Anchor,
    title: "Varadero e invernaje",
    text: "Varada con travel-lift, estancia en seco, invernaje y puesta a punto antes de la temporada.",
    items: ["Travel-lift", "Invernaje", "Puesta a punto de temporada"],
  },
];

export function Services() {
  return (
    <section id="servicios" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <RevealItem>
            <p className="text-[13px] font-medium text-accent">Servicios</p>
          </RevealItem>
          <RevealItem>
            <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance">
              Todo lo que necesita tu barco, <span className="font-serif font-normal italic">en un solo taller.</span>
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
              Velero o motor, de 6 a 25 metros. Trabajamos en tu amarre o en nuestro varadero, y te contamos qué hacemos en cada paso.
            </p>
          </RevealItem>
        </Reveal>

        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
          {SERVICES.map(({ icon: Icon, title, text, items }) => (
            <RevealItem key={title} className="h-full">
              <SpotlightCard className="h-full p-6">
                <div className="relative">
                  <div className="mb-5 flex size-10 items-center justify-center rounded-xl border border-border bg-background">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
                  <ul className="mt-5 flex flex-wrap gap-1.5">
                    {items.map((i) => (
                      <li key={i} className="rounded-full bg-muted px-2.5 py-1 text-[12px] text-muted-foreground">
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              </SpotlightCard>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
