"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { AnimatedNumber, Reveal, RevealItem } from "@/components/ui/motion";

const STATS = [
  { value: 30, suffix: "+", label: "años en el mercado español" },
  { value: 6, suffix: "", label: "especialidades a bordo" },
  { value: 2, suffix: "", label: "talleres: Diplonautic y ElectroMotor" },
];

const VALUES = [
  { title: "Proyectos a medida", text: "Cada barco es distinto: estudiamos la instalación, el consumo y el espacio antes de proponer una solución." },
  { title: "Tecnología de punta", text: "Trabajamos con equipos actuales y material marino, pensados para durar en un entorno exigente." },
  { title: "Todo explicado", text: "Al terminar te contamos qué se hizo y qué equipos se instalaron, para que sepas siempre cómo está tu barco." },
];

export function Company() {
  const ref = useRef<HTMLElement>(null);
  // La foto se mueve más lento que la página (parallax)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <section id="empresa" ref={ref} className="relative isolate scroll-mt-24 overflow-hidden bg-[#0b1f3a] py-28 text-white sm:py-32">
      <motion.div style={{ y }} className="absolute inset-[-14%_0] -z-20">
        <Image src="/barcos/yate-deportivo.jpg" alt="" fill sizes="100vw" className="object-cover object-[60%_55%]" />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#0b1f3a_0%,rgba(11,31,58,.94)_38%,rgba(11,31,58,.55)_72%,rgba(11,31,58,.3)_100%)]" />

      <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <Reveal>
          <RevealItem>
            <p className="text-[13px] font-medium text-sky-300">La empresa</p>
          </RevealItem>
          <RevealItem>
            <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance">
              Más de 30 años <span className="font-serif font-normal text-sky-300 italic">a bordo de tu barco.</span>
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mt-5 text-[16px] leading-relaxed text-white/75">
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
                  <dd className="mt-2 text-[13px] text-white/60">{s.label}</dd>
                </div>
              ))}
            </dl>
          </RevealItem>
        </Reveal>

        <Reveal className="grid content-center gap-4" stagger={0.1}>
          {VALUES.map((v, i) => (
            <RevealItem key={v.title}>
              <div className="flex gap-4 rounded-2xl border border-white/10 bg-[#0b1f3a]/60 p-5 backdrop-blur-md">
                <span className="font-serif text-[28px] leading-none text-sky-300 italic">{i + 1}</span>
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight">{v.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-white/70">{v.text}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
