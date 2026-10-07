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
      <SiteHeader signedIn={!!user} />
      <main className="bg-white">
        {/* Hero + taller en 3D */}
        <section className="relative isolate pt-32 pb-20 sm:pt-40">
          <ChartBackground />
          <Reveal className="mx-auto max-w-3xl px-6 text-center">
            <RevealItem>
              <p className="text-[12.5px] font-medium tracking-[0.22em] text-blue-700 uppercase">ElectroMotor · Taller de Diplonautic</p>
            </RevealItem>
            <RevealItem>
              <h1 className="mt-4 text-[clamp(2.3rem,5.4vw,4.1rem)] leading-[1.03] font-semibold tracking-[-0.045em] text-balance text-slate-950">
                Alternadores y motores de arranque, <span className="font-serif font-normal text-blue-700 italic">por dentro.</span>
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">
                Reparamos la parte eléctrica que hace arrancar y cargar a barcos y vehículos. Elegí un equipo, desmontalo y mirá qué
                revisamos pieza por pieza.
              </p>
            </RevealItem>
          </Reveal>
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
