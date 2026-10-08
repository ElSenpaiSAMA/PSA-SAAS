import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Car, Gauge, MapPin, Phone, Ship } from "lucide-react";
import { ChartBackground } from "@/components/marketing/chart-background";
import { SiteFooter } from "@/components/marketing/final-cta";
import { SiteHeader } from "@/components/marketing/site-header";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { company } from "@/lib/brand";
import { getUser } from "@/lib/data/session";
import { BenchSteps } from "@/components/marketing/electromotor/bench-steps";
import { MachineStage } from "@/components/marketing/electromotor/machine-stage";

export const metadata: Metadata = {
  title: "ElectroMotor",
  description: "Reparación de alternadores, motores de arranque, dinamos, motores eléctricos y bombas de barcos y vehículos en Sant Adrià de Besòs.",
};

const POINTS = [
  { icon: <Gauge className="size-5" strokeWidth={1.75} />, title: "Banco de pruebas propio", text: "Cada equipo se prueba al entrar y antes de salir del taller." },
  { icon: <Ship className="size-5" strokeWidth={1.75} />, title: "Barcos", text: "Alternadores, arranques, molinetes, hélices de proa y bombas de a bordo." },
  { icon: <Car className="size-5" strokeWidth={1.75} />, title: "Y vehículos", text: "También coches, furgonetas y maquinaria: la misma reparación." },
  { icon: <MapPin className="size-5" strokeWidth={1.75} />, title: "En Sant Adrià de Besòs", text: "Junto al puerto, en el mismo taller de Diplonautic." },
];

export default async function ElectromotorPage() {
  const user = await getUser();

  return (
    <>
      <SiteHeader signedIn={!!user} overDark />
      <main className="bg-white">
        {/* Encabezado con foto, como Contacto y Diplonautic */}
        <section className="relative isolate overflow-hidden pt-36 pb-36 text-white sm:pt-44">
          <Image src="/barcos/yate-deportivo.jpg" alt="" fill preload sizes="100vw" className="-z-20 object-cover object-[60%_50%]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,31,58,.86)_0%,rgba(18,58,107,.66)_55%,rgba(11,31,58,.88)_100%)]" />
          <Reveal className="mx-auto max-w-6xl px-6">
            <RevealItem>
              <p className="text-[12.5px] font-medium tracking-[0.22em] text-sky-300 uppercase">ElectroMotor · Taller de Diplonautic</p>
            </RevealItem>
            <RevealItem>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
                Alternadores y motores de arranque, <span className="font-serif font-normal text-sky-300 italic">como nuevos.</span>
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">
                Reparamos la parte eléctrica que hace arrancar y cargar a barcos y vehículos, con banco de pruebas propio en Sant Adrià de
                Besòs.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/contacto?servicio=electromotor"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-6 text-[15px] font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Pedir presupuesto <ArrowRight className="size-4" />
                </Link>
                <a href={company.phoneHref} className="inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-[15px] text-white/85 hover:bg-white/10">
                  <Phone className="size-4" /> {company.phone}
                </a>
              </div>
            </RevealItem>
          </Reveal>
          <svg aria-hidden className="absolute inset-x-0 -bottom-px h-24 w-full text-[#e6f0fc]" viewBox="0 0 1440 96" preserveAspectRatio="none">
            <path d="M0 50 C240 10 480 90 720 50 S1200 10 1440 50 V96 H0 Z" fill="currentColor" />
          </svg>
        </section>

        {/* El taller en 3D, sobre la carta náutica */}
        <section className="relative isolate pt-12 pb-20 sm:pt-16" aria-labelledby="taller-title">
          <ChartBackground />
          <div className="mx-auto max-w-6xl px-6 text-center">
            <p className="text-[13px] font-medium text-blue-700">El taller</p>
            <h2 id="taller-title" className="mt-2 text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-slate-950">
              Elegí un equipo <span className="font-serif font-normal text-blue-700 italic">y mirá qué revisamos.</span>
            </h2>
          </div>
          <div className="mx-auto mt-4 max-w-6xl px-6">
            <MachineStage />
          </div>
        </section>

        {/* Por qué ElectroMotor */}
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

        {/* El recorrido en el taller */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-[13px] font-medium text-blue-700">El taller</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3.5vw,2.4rem)] leading-[1.1] font-semibold tracking-[-0.035em] text-slate-950">
              Del banco de pruebas <span className="font-serif font-normal text-blue-700 italic">de vuelta al motor.</span>
            </h2>
            <BenchSteps />
          </div>
        </section>

        {/* Reparaciones de barcos (como en la web original) */}
        <section className="pb-24">
          <div className="mx-auto grid max-w-6xl items-stretch gap-4 px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-[300px] overflow-hidden rounded-3xl">
              <Image src="/barcos/yate-turquesa.jpg" alt="Yate fondeado en aguas turquesa" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
            </div>
            <div className="flex flex-col justify-center rounded-3xl border border-blue-100 bg-[#f4f8fe] p-8">
              <p className="text-[13px] font-medium text-blue-700">Reparaciones de barcos en Barcelona</p>
              <p className="mt-2 text-[24px] leading-snug font-semibold tracking-tight text-slate-950">
                ¿El problema está en otra parte del barco?
              </p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">
                Diplonautic también instala y mantiene generadores, baterías, potabilizadoras, aire acondicionado y refrigeración.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/#servicios" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-[14px] font-medium text-blue-700 ring-1 ring-blue-200 hover:ring-blue-400">
                  Ver servicios <ArrowRight className="size-4" />
                </Link>
                <Link href="/contacto?servicio=electromotor" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-[14px] font-medium text-white hover:bg-blue-500">
                  Pedir presupuesto
                </Link>
                <a href={company.phoneHref} className="inline-flex h-11 items-center gap-2 px-2 text-[14px] text-slate-700 hover:text-blue-700">
                  <Phone className="size-4" /> {company.phone}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
