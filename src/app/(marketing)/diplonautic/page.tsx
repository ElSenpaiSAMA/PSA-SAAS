import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, MapPin, Phone, Ruler, Ship } from "lucide-react";
import { ChartBackground } from "@/components/marketing/chart-background";
import { BoatTour } from "@/components/marketing/diplonautic/boat-tour";
import { BrandsMarquee } from "@/components/marketing/diplonautic/brands-marquee";
import { BOAT_SERVICES, BOAT_STEPS } from "@/components/marketing/diplonautic/content";
import { BenchSteps } from "@/components/marketing/electromotor/bench-steps";
import { SiteFooter } from "@/components/marketing/final-cta";
import { SiteHeader } from "@/components/marketing/site-header";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { company } from "@/lib/brand";
import { getUser } from "@/lib/data/session";

export const metadata: Metadata = {
  title: "Mantenimiento de barcos",
  description:
    "Aire acondicionado, refrigeración, generadores, potabilizadoras, sistemas eléctricos y hélices de proa para barcos de 6 a 50 metros en Barcelona.",
};

const POINTS = [
  { icon: <Ruler className="size-5" strokeWidth={1.75} />, title: "De 6 a 50 metros", text: "Desde lanchas hasta superyates: cada instalación, a la medida del barco." },
  { icon: <Award className="size-5" strokeWidth={1.75} />, title: "Marcas de referencia", text: "Trabajamos con los fabricantes líderes de cada equipo." },
  { icon: <Ship className="size-5" strokeWidth={1.75} />, title: "En tu amarre", text: "Diagnóstico y trabajo a bordo, sin mover el barco cuando no hace falta." },
  { icon: <MapPin className="size-5" strokeWidth={1.75} />, title: "En Sant Adrià de Besòs", text: "Junto al puerto, donde también está el taller de ElectroMotor." },
];

export default async function DiplonauticPage() {
  const user = await getUser();

  return (
    <>
      <SiteHeader signedIn={!!user} overDark />
      <main className="bg-white">
        {/* Encabezado con foto, como Contacto */}
        <section className="relative isolate overflow-hidden pt-36 pb-36 text-white sm:pt-44">
          <Image src="/diplonautic/refrigeracion.jpg" alt="" fill preload sizes="100vw" className="-z-20 object-cover object-[60%_50%]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,31,58,.84)_0%,rgba(18,58,107,.62)_55%,rgba(11,31,58,.86)_100%)]" />
          <Reveal className="mx-auto max-w-6xl px-6">
            <RevealItem>
              <p className="text-[12.5px] font-medium tracking-[0.22em] text-sky-300 uppercase">Diplonautic · Equipos de a bordo</p>
            </RevealItem>
            <RevealItem>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
                Mantenimiento de barcos <span className="font-serif font-normal text-sky-300 italic">en Barcelona.</span>
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">
                Instalamos, reparamos y mantenemos los equipos de a bordo de barcos de 6 a 50 metros, con un equipo técnico especializado en
                cada sistema.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/contacto" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-6 text-[15px] font-medium text-white transition-colors hover:bg-blue-500">
                  Pedir presupuesto <ArrowRight className="size-4" />
                </Link>
                <a href={company.phoneHref} className="inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-[15px] text-white/85 hover:bg-white/10">
                  <Phone className="size-4" /> {company.phone}
                </a>
              </div>
            </RevealItem>
            {/* Accesos directos a cada servicio */}
            <RevealItem>
              <ul className="mt-12 flex flex-wrap gap-2" aria-label="Servicios">
                {BOAT_SERVICES.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href="#recorrido"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[13px] text-white/90 backdrop-blur transition-colors hover:bg-white/20"
                    >
                      <span className="font-mono text-[11px] text-sky-300">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </RevealItem>
          </Reveal>
          <svg aria-hidden className="absolute inset-x-0 -bottom-px h-24 w-full text-[#f0f6fd]" viewBox="0 0 1440 96" preserveAspectRatio="none">
            <path d="M0 50 C240 10 480 90 720 50 S1200 10 1440 50 V96 H0 Z" fill="currentColor" />
          </svg>
        </section>

        {/* Recorrido por dentro del barco */}
        <section id="recorrido" className="relative isolate scroll-mt-20 py-16 sm:py-20" aria-labelledby="servicios-title">
          {/* La ola del encabezado usa el mismo tono que este fondo suavizado (#f0f6fd) */}
          <ChartBackground subtle flowInto />
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-[13px] font-medium text-blue-700">Servicios a bordo</p>
                <h2 id="servicios-title" className="mt-2 max-w-2xl text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-slate-950">
                  Un recorrido por tu barco, <span className="font-serif font-normal text-blue-700 italic">de popa a proa.</span>
                </h2>
              </div>
              <p className="max-w-sm text-[15px] leading-relaxed text-slate-600">
                Cada equipo tiene su lugar a bordo. Elegí uno para ver dónde va, qué hace y cómo lo cuidamos.
              </p>
            </div>
            <div className="mt-8">
              <BoatTour />
            </div>
          </div>
        </section>

        {/* Los seis servicios de un vistazo */}
        <section className="relative z-10 pb-20" aria-labelledby="vistazo-title">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="vistazo-title" className="text-[clamp(1.4rem,3vw,1.9rem)] font-semibold tracking-[-0.03em] text-slate-950">
              Los seis servicios, <span className="font-serif font-normal text-blue-700 italic">de un vistazo.</span>
            </h2>
            <Reveal className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BOAT_SERVICES.map((s, i) => (
                <RevealItem key={s.id}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_18px_40px_-30px_rgba(11,31,58,0.45)] transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(11,31,58,0.55)]">
                    <div className="relative h-40 overflow-hidden">
                      <Image src={s.photo} alt="" fill sizes="(min-width: 1024px) 370px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                      <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 font-mono text-[11px] text-blue-700 backdrop-blur">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-[17px] font-semibold tracking-tight text-slate-950">{s.title}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{s.summary}</p>
                      <Link
                        href={`/contacto?servicio=${s.id}`}
                        className="mt-auto inline-flex items-center gap-1 pt-4 text-[13.5px] font-medium text-blue-700 hover:underline hover:underline-offset-4"
                      >
                        Pedir presupuesto <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </article>
                </RevealItem>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Marcas */}
        <section className="border-y border-blue-100 bg-[#f4f8fe] py-12">
          <p className="mb-6 text-center text-[12.5px] font-medium tracking-[0.18em] text-blue-700 uppercase">Marcas con las que trabajamos</p>
          <BrandsMarquee />
        </section>

        {/* Por qué Diplonautic */}
        <section className="bg-[linear-gradient(120deg,#0b1f3a,#123a6b)] py-16 text-white">
          <Reveal className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map((p) => (
              <RevealItem key={p.title}>
                <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-sky-300">{p.icon}</span>
                <p className="mt-4 text-[16px] font-semibold">{p.title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">{p.text}</p>
              </RevealItem>
            ))}
          </Reveal>
        </section>

        {/* Cómo trabajamos */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-[13px] font-medium text-blue-700">Cómo trabajamos</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3.5vw,2.4rem)] leading-[1.1] font-semibold tracking-[-0.035em] text-slate-950">
              Cuatro pasos, <span className="font-serif font-normal text-blue-700 italic">sin sorpresas.</span>
            </h2>
            <BenchSteps steps={BOAT_STEPS} />
          </div>
        </section>

        {/* ElectroMotor, el otro taller */}
        <section className="pb-24">
          <div className="mx-auto grid max-w-6xl items-stretch gap-4 px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-[300px] overflow-hidden rounded-3xl bg-white ring-1 ring-blue-100">
              <Image src="/motores/alternador.jpg" alt="Alternador reparado en el taller de ElectroMotor" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-contain p-8" />
            </div>
            <div className="flex flex-col justify-center rounded-3xl border border-blue-100 bg-[#f4f8fe] p-8">
              <p className="text-[13px] font-medium text-blue-700">También en el grupo</p>
              <p className="mt-2 text-[24px] leading-snug font-semibold tracking-tight text-slate-950">¿El motor no arranca o no carga?</p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">
                En ElectroMotor, nuestro taller, reparamos alternadores, motores de arranque, dinamos, motores eléctricos y bombas.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/electromotor" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-[14px] font-medium text-blue-700 ring-1 ring-blue-200 hover:ring-blue-400">
                  Ver ElectroMotor <ArrowRight className="size-4" />
                </Link>
                <Link href="/contacto" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-[14px] font-medium text-white hover:bg-blue-500">
                  Pedir presupuesto
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
