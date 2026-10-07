import { ClipboardCheck, MessageSquareText, Ship, Wrench } from "lucide-react";
import { Reveal, RevealItem } from "@/components/ui/motion";

const STEPS = [
  { icon: MessageSquareText, title: "Nos contás qué pasa", text: "Por el formulario o por teléfono. Con el modelo del barco y del equipo ya podemos orientarte." },
  { icon: ClipboardCheck, title: "Diagnóstico y presupuesto", text: "Revisamos la instalación en tu amarre y te enviamos un presupuesto detallado antes de empezar." },
  { icon: Wrench, title: "Reparación", text: "Un técnico especializado se encarga del trabajo y te mantiene al tanto del avance." },
  { icon: Ship, title: "Prueba y entrega", text: "Probamos los equipos en funcionamiento y te entregamos el detalle de lo que se hizo." },
];

export function Process() {
  return (
    <section id="proceso" className="scroll-mt-24 bg-[#eef5ff] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <RevealItem>
            <p className="text-[13px] font-medium text-blue-700">Cómo trabajamos</p>
          </RevealItem>
          <RevealItem>
            <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance">
              Cuatro pasos, <span className="font-serif font-normal text-blue-700 italic">sin sorpresas.</span>
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="relative mt-16 grid gap-8 md:grid-cols-4 md:gap-6" stagger={0.12}>
          {/* Línea que une los pasos (solo en horizontal) */}
          <div aria-hidden className="absolute top-6 right-[12.5%] left-[12.5%] hidden h-px bg-blue-200 md:block" />
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <RevealItem key={title} className="relative text-center">
              <div className="relative mx-auto flex size-12 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-700 shadow-[0_10px_24px_-14px_rgba(29,78,216,0.5)]">
                <Icon className="size-5" strokeWidth={1.75} />
                <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-medium text-white">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-[16px] font-semibold tracking-tight">{title}</h3>
              <p className="mx-auto mt-2 max-w-60 text-[14px] leading-relaxed text-slate-600">{text}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
