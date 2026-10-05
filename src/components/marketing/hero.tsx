"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ProductPreview } from "./product-preview";

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

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // El preview arranca inclinado en perspectiva y se "asienta" al hacer scroll
  const rotateX = useTransform(scrollYProgress, [0, 0.35], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.35], [0.94, 1]);
  const y = useTransform(scrollYProgress, [0, 0.35], [0, -40]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0.3]);

  const headline = ["El", "tiempo", "de", "tu", "equipo,"];

  return (
    <section ref={ref} className="relative overflow-hidden pt-36 pb-24 sm:pt-44">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <motion.div
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute top-[-20%] left-1/2 -z-10 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]"
      />

      <div className="mx-auto max-w-6xl px-6 text-center">
        <motion.a
          href="#producto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="group mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pr-3 pl-1 text-[12.5px] text-muted-foreground backdrop-blur transition-colors hover:border-border-strong hover:text-foreground"
        >
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Nuevo</span>
          Aprobaciones por jerarquía
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </motion.a>

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
            en orden.
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
          <Link href="/signup" className={cn(buttonClasses("primary", "lg"), "group")}>
            Crear mi organización
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
          <Link href="/login" className={buttonClasses("secondary", "lg")}>
            Ver la demo
          </Link>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 1 }}
          className="mt-4 text-[12.5px] text-muted-foreground"
        >
          Sin tarjeta · Configuración en 2 minutos
        </motion.p>
      </div>

      <div className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 [perspective:1600px]">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1.4, ease: EASE }}
        >
          <motion.div style={{ rotateX, scale, y }} className="origin-top">
            <ProductPreview />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
