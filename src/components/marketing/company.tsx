import { AnimatedNumber, Reveal, RevealItem } from "@/components/ui/motion";

const STATS = [
  { value: 30, suffix: "+", label: "años en el mercado español" },
  { value: 6, suffix: "", label: "especialidades a bordo" },
  { value: 2, suffix: "", label: "talleres: Diplonautic y ElectroMotor" },
];

const VALUES = [
  { title: "Proyectos a medida", text: "Cada barco es distinto: estudiamos la instalación, el consumo y el espacio antes de proponer una solución." },
  { title: "Tecnología de punta", text: "Trabajamos con equipos actuales y material marino, pensados para durar en un entorno exigente." },
  { title: "Trabajo documentado", text: "Cada intervención queda registrada: equipos, piezas, horas y técnico. El historial de tu barco, siempre disponible." },
];

export function Company() {
  return (
    <section id="empresa" className="relative scroll-mt-24 border-y border-border bg-muted/30 py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <Reveal>
          <RevealItem>
            <p className="text-[13px] font-medium text-accent">La empresa</p>
          </RevealItem>
          <RevealItem>
            <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance">
              Más de 30 años <span className="font-serif font-normal italic">a bordo de tu barco.</span>
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
              Diplonautic es una empresa de instalaciones y diseños náuticos de Barcelona. Desde Sant Adrià de Besòs instalamos, reparamos y
              mantenemos los equipos eléctricos de yates y embarcaciones, con un equipo técnico especializado y proyectos personalizados.
            </p>
          </RevealItem>
          <RevealItem>
            <dl className="mt-10 grid grid-cols-3 gap-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-[34px] leading-none font-semibold tracking-[-0.04em]">
                    <AnimatedNumber value={s.value} />
                    {s.suffix}
                  </dd>
                  <dd className="mt-2 text-[13px] text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </dl>
          </RevealItem>
        </Reveal>

        <Reveal className="grid content-center gap-4" stagger={0.1}>
          {VALUES.map((v, i) => (
            <RevealItem key={v.title}>
              <div className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <span className="font-serif text-[28px] leading-none text-accent italic">{i + 1}</span>
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight">{v.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{v.text}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
