"use client";

import Image from "next/image";
import { animate, motion, useInView, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const PHOTOS: { src: string; label: string; tall?: boolean }[] = [
  { src: "/barcos/yate-turquesa.jpg", label: "Climatización a bordo" },
  { src: "/barcos/superyate-muelle.jpg", label: "Superyates en puerto", tall: true },
  { src: "/barcos/yate-mar-abierto.jpg", label: "Generadores para navegar sin cortes" },
  { src: "/barcos/marina-amarre.jpg", label: "Mantenimiento en el amarre" },
  { src: "/barcos/yate-deportivo.jpg", label: "Sistemas eléctricos y baterías" },
  { src: "/barcos/yate-atardecer.jpg", label: "Iluminación y equipos a bordo" },
  { src: "/barcos/superyate-puerto.jpg", label: "Instalación eléctrica en puerto" },
];

/**
 * Carrusel de fotos: avanza solo (despacio) hasta la última y se detiene. Se puede
 * arrastrar con el mouse o el dedo; tocarlo cancela el avance.
 */
export function Gallery() {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [max, setMax] = useState(0);
  const autoplay = useRef<AnimationPlaybackControls | null>(null);
  const inView = useInView(viewport, { once: true, amount: 0.5 });
  const still = useReducedMotion();

  // Recorrido posible: lo que el carril excede a la ventana
  useEffect(() => {
    const measure = () => {
      if (!viewport.current || !track.current) return;
      setMax(Math.max(0, track.current.scrollWidth - viewport.current.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (viewport.current) ro.observe(viewport.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || still || max === 0) return;
    autoplay.current = animate(x, -max, { duration: max / 45, ease: "linear", delay: 0.6 });
    return () => autoplay.current?.stop();
  }, [inView, still, max, x]);

  const stopAutoplay = () => autoplay.current?.stop();

  return (
    <section className="overflow-hidden bg-white py-20" aria-labelledby="gallery-title">
      <div className="mx-auto mb-10 max-w-6xl px-6">
        <div>
          <p className="text-[13px] font-medium text-blue-700">A bordo</p>
          <h2 id="gallery-title" className="mt-2 text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.04em] text-slate-950">
            Barcos en los que <span className="font-serif font-normal text-blue-700 italic">trabajamos.</span>
          </h2>
        </div>
      </div>

      <div ref={viewport} className="overflow-hidden">
        <motion.div
          ref={track}
          style={{ x, paddingLeft: 24, paddingRight: "max(24px, calc((100vw - 72rem) / 2 + 24px))" }}
          drag={max > 0 ? "x" : false}
          dragConstraints={{ left: -max, right: 0 }}
          dragElastic={0.08}
          onPointerDown={stopAutoplay}
          className={cn("flex w-max gap-5", max > 0 && "cursor-grab active:cursor-grabbing")}
        >
          {PHOTOS.map((p) => (
            <figure
              key={p.src}
              className={cn(
                "group relative h-72 shrink-0 overflow-hidden rounded-3xl shadow-[0_20px_50px_-30px_rgba(11,31,58,.6)] sm:h-80",
                p.tall ? "w-[min(60vw,240px)]" : "w-[min(80vw,460px)]",
              )}
            >
              <Image
                src={p.src}
                alt={p.label}
                fill
                draggable={false}
                sizes={p.tall ? "240px" : "(max-width: 640px) 80vw, 460px"}
                className="object-cover transition-transform duration-700 select-none group-hover:scale-105"
              />
              <figcaption className="absolute inset-x-3 bottom-3 rounded-xl bg-white/90 px-3 py-2 text-[13px] font-medium text-slate-800 backdrop-blur">
                {p.label}
              </figcaption>
            </figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
