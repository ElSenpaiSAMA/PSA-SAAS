"use client";

import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const steps = [
  {
    n: "01",
    title: "Creá tu organización",
    text: "Registrate y creá tu empresa en segundos. Quedás como owner, con control total.",
  },
  {
    n: "02",
    title: "Invitá a tu equipo",
    text: "Invitá por email con su rol, puesto y manager. El organigrama se arma solo, y cada permiso sale de ahí.",
  },
  {
    n: "03",
    title: "Medí y decidí",
    text: "Fichajes, horas por proyecto y vacaciones en tiempo real. Detectá sobrecarga y aprobá con contexto.",
  },
];

function Step({ index, active, onActive, children }: { index: number; active: boolean; onActive: (i: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);

  return (
    <div ref={ref} className={cn("py-10 transition-opacity duration-500 md:py-16", active ? "opacity-100" : "opacity-30")}>
      {children}
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);

  return (
    <section id="como-funciona" className="relative border-y border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2 md:gap-16">
        <div className="pt-24 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-center md:pt-0">
          <p className="mb-4 text-[13px] font-medium text-accent">Cómo funciona</p>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
            De cero a tu equipo funcionando en <span className="font-serif font-normal italic">tres pasos.</span>
          </h2>
          <div className="mt-10 hidden gap-2 md:flex">
            {steps.map((s, i) => (
              <div key={s.n} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full bg-foreground"
                  initial={false}
                  animate={{ width: i <= active ? "100%" : "0%" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pb-16 md:py-[18vh]">
          {steps.map((s, i) => (
            <Step key={s.n} index={i} active={active === i} onActive={setActive}>
              <span className="font-mono text-[13px] text-muted-foreground">{s.n}</span>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{s.title}</h3>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-muted-foreground">{s.text}</p>
            </Step>
          ))}
        </div>
      </div>
    </section>
  );
}
