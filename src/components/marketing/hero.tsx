"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, Droplets, Fan, Phone, Plug, ShieldCheck, Snowflake, Wrench, Zap, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { company } from "@/lib/brand";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const SPECIALTIES: { text: string; icon: LucideIcon }[] = [
  { text: "Aire acondicionado", icon: Fan },
  { text: "Refrigeración", icon: Snowflake },
  { text: "Generadores", icon: Zap },
  { text: "Potabilizadoras", icon: Droplets },
  { text: "Sistemas eléctricos", icon: Plug },
];

const PROMISES = [
  { icon: Clock3, text: "Más de 30 años de experiencia" },
  { icon: Wrench, text: "Proyectos a medida" },
  { icon: ShieldCheck, text: "Presupuesto antes de empezar" },
];

/** "Especialistas en …": las especialidades se turnan en una píldora en lugar de leerse en una lista larga. */
function RotatingSpecialty() {
  const still = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setI((n) => (n + 1) % SPECIALTIES.length), 2200);
    return () => clearInterval(t);
  }, [still]);
  const { text, icon: Icon } = SPECIALTIES[i];
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 text-[15px] text-white/75">
      <span>Especialistas en</span>
      <motion.span
        layout
        transition={{ layout: { duration: 0.45, ease: EASE } }}
        className="inline-flex h-9 items-center overflow-hidden rounded-full border border-white/20 bg-white/10 px-3.5 font-medium text-white backdrop-blur"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Icon className="size-4 text-sky-300" strokeWidth={1.75} />
            {text}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1.15]);

  return (
    <section ref={ref} className="relative isolate flex min-h-[760px] items-center overflow-hidden pt-28 pb-40 text-white">
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-20">
        <Image src="/barcos/yate-atardecer.jpg" alt="" fill preload sizes="100vw" className="object-cover object-[60%_55%]" />
      </motion.div>
      {/* Velo azul en degradé para que el texto se lea sobre la foto */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,31,58,.78)_0%,rgba(18,58,107,.62)_45%,rgba(11,31,58,.85)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgba(59,130,246,.25),transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="text-[12.5px] font-medium tracking-[0.22em] text-sky-300 uppercase"
        >
          Instalaciones y diseños náuticos · Barcelona
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.15, duration: 1, ease: EASE }}
          className="mt-5 text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance"
        >
          Tu barco, listo <span className="font-serif font-normal text-sky-300 italic">para zarpar.</span>
        </motion.h1>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.9, ease: EASE }}>
          <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-balance text-white/75">
            Instalamos, reparamos y mantenemos los equipos eléctricos y de confort de tu barco.
          </p>
          <RotatingSpecialty />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.9, ease: EASE }}
          className="mt-9 flex flex-wrap justify-center gap-3"
        >
          <Link href="/contacto" className={cn(buttonClasses("primary", "lg"), "group bg-blue-600 text-white shadow-[0_12px_30px_-12px_rgba(37,99,235,0.9)] hover:bg-blue-500")}>
            Pedir presupuesto <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
          <a href={company.phoneHref} className={cn(buttonClasses("secondary", "lg"), "border-white/25 bg-white/5 text-white backdrop-blur hover:bg-white/10")}>
            <Phone className="size-4" /> {company.phone}
          </a>
        </motion.div>
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 1 }}
          className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-white/75"
        >
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <Icon className="size-4 text-sky-300" strokeWidth={1.75} /> {text}
            </li>
          ))}
        </motion.ul>
      </div>

      {/* Borde inferior en forma de ola, que da paso a la carta náutica */}
      <svg aria-hidden className="absolute inset-x-0 -bottom-px h-24 w-full text-[#e6f0fc]" viewBox="0 0 1440 96" preserveAspectRatio="none">
        <path d="M0 50 C240 10 480 90 720 50 S1200 10 1440 50 V96 H0 Z" fill="currentColor" />
      </svg>
    </section>
  );
}
