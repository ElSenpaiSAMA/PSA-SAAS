"use client";

import Link from "next/link";
import { ArrowRight, Clock3, ShieldCheck, Wrench } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { HeroCollage } from "./hero-collage";

const EASE = [0.16, 1, 0.3, 1] as const;

const word = {
  hidden: { opacity: 0, y: "0.4em", filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.15 + i * 0.07, duration: 0.9, ease: EASE },
  }),
};

const PROMISES = [
  { icon: Clock3, text: "Más de 30 años de experiencia" },
  { icon: Wrench, text: "Proyectos a medida" },
  { icon: ShieldCheck, text: "Presupuesto antes de empezar" },
];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const glowOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.3]);

  const headline = ["Tu", "barco,", "listo"];

  return (
    <section ref={ref} className="relative overflow-hidden pt-36 pb-28 sm:pt-44 xl:min-h-[820px]">
      <HeroCollage glowOpacity={glowOpacity} />

      <div className="mx-auto max-w-6xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pr-3 pl-1 text-[12.5px] text-muted-foreground backdrop-blur"
        >
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Instalaciones náuticas</span>
          Electricidad, clima, energía y agua a bordo
        </motion.p>

        <h1 className="mx-auto max-w-4xl text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance">
          {headline.map((w, i) => (
            <motion.span key={i} custom={i} variants={word} initial="hidden" animate="show" className="inline-block pr-[0.22em]">
              {w}
            </motion.span>
          ))}
          <motion.span
            custom={headline.length}
            variants={word}
            initial="hidden"
            animate="show"
            className="inline-block font-serif font-normal tracking-[-0.02em] italic"
          >
            para zarpar.
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.9, ease: EASE }}
          className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-muted-foreground text-balance"
        >
          {brand.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.9, ease: EASE }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/contacto" className={cn(buttonClasses("primary", "lg"), "group")}>
            Pedir presupuesto
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
          <Link href="/#servicios" className={buttonClasses("secondary", "lg")}>
            Ver servicios
          </Link>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 1 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground"
        >
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <Icon className="size-4 text-accent" strokeWidth={1.75} />
              {text}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
