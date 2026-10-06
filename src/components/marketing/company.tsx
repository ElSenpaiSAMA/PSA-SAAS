import { AnimatedNumber, Reveal, RevealItem } from "@/components/ui/motion";

const STATS = [
  { value: 15, suffix: "+", label: "años reparando barcos" },
  { value: 1200, suffix: "+", label: "barcos atendidos" },
  { value: 9, suffix: "", label: "técnicos especializados" },
  { value: 48, suffix: " h", label: "para el diagnóstico" },
];

const VALUES = [
  { title: "Presupuesto cerrado", text: "Antes de tocar nada sabés qué vamos a hacer y cuánto cuesta. Si aparece algo nuevo, te consultamos primero." },
  { title: "Te mantenemos al tanto", text: "Fotos del avance y un responsable que te atiende de principio a fin: nada de llamar para preguntar cómo va." },
  { title: "Trabajo documentado", text: "Cada intervención queda registrada: piezas, horas y técnico. El historial de tu barco, siempre disponible." },
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
              Un taller de puerto, <span className="font-serif font-normal italic">con oficio y método.</span>
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
              Diplonautic nació en el muelle, arreglando los barcos de los vecinos de amarre. Hoy somos un equipo de mecánicos,
              electricistas, pintores y riggers que comparte una forma de trabajar: diagnosticar bien, explicar claro y entregar a tiempo.
            </p>
          </RevealItem>
          <RevealItem>
            <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
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
