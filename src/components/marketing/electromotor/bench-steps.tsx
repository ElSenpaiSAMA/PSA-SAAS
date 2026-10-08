"use client";

import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import { ELECTRO_STEPS } from "@/components/marketing/electromotor/content";
import { cn } from "@/lib/utils";

type StepItem = { title: string; text: string };

/** Los pasos del taller: la línea se va cargando con el scroll y cada paso se enciende al llegar. */

export function BenchSteps({ steps = ELECTRO_STEPS }: { steps?: StepItem[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const width = useTransform(progress, [0, 1], ["0%", "100%"]);

  return (
    <ol ref={ref} className={cn("relative mt-12 grid gap-8 md:gap-4", steps.length === 4 ? "md:grid-cols-4" : "md:grid-cols-5")}>
      {/* La línea va del centro del primer paso al del último */}
      <span aria-hidden style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }} className="absolute top-5 hidden h-0.5 rounded-full bg-blue-100 md:block">
        <motion.span className="block h-full rounded-full bg-blue-600" style={{ width }} />
      </span>
      {steps.map((step, i) => (
        <Step key={step.title} i={i} total={steps.length} progress={progress} title={step.title} text={step.text} />
      ))}
    </ol>
  );
}

function Step({ i, total, progress, title, text }: { i: number; total: number; progress: ReturnType<typeof useSpring>; title: string; text: string }) {
  const at = i / (total - 1);
  const on = useTransform(progress, [Math.max(0, at - 0.08), at], [0, 1]);
  const bg = useTransform(on, [0, 1], ["#ffffff", "#2563eb"]);
  const fg = useTransform(on, [0, 1], ["#2563eb", "#ffffff"]);
  return (
    <li className="relative text-center">
      <motion.span
        style={{ backgroundColor: bg, color: fg }}
        className="relative mx-auto grid size-10 place-items-center rounded-full border border-blue-200 font-mono text-[13px] ring-8 ring-white"
      >
        {String(i + 1).padStart(2, "0")}
      </motion.span>
      <p className="mt-4 text-[15px] font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-1 max-w-[14rem] text-[13px] leading-relaxed text-slate-600">{text}</p>
    </li>
  );
}
