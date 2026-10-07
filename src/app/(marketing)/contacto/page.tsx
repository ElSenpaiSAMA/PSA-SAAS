import type { Metadata } from "next";
import Image from "next/image";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import { ChartBackground } from "@/components/marketing/chart-background";
import { SiteFooter } from "@/components/marketing/final-cta";
import { SiteHeader } from "@/components/marketing/site-header";
import { company } from "@/lib/brand";
import { CONTACT_SERVICES } from "@/lib/validation/schemas";
import { getUser } from "@/lib/data/session";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Pedí presupuesto para la instalación, reparación o mantenimiento de los equipos de tu barco.",
};

// /contacto?servicio=electromotor llega con el servicio ya elegido en el formulario
const SERVICE_BY_PARAM: Record<string, (typeof CONTACT_SERVICES)[number]> = {
  electromotor: "ElectroMotor: arranque, alternador o dinamo",
};

const CHANNELS = [
  { icon: Phone, label: "Teléfono", value: company.phone, href: company.phoneHref },
  { icon: Mail, label: "Email", value: company.email, href: `mailto:${company.email}` },
  { icon: MapPin, label: "Dirección", value: `${company.address}, ${company.city}` },
  { icon: Clock3, label: "Horario", value: company.hours },
];

export default async function ContactPage({ searchParams }: PageProps<"/contacto">) {
  const [user, { servicio }] = await Promise.all([getUser(), searchParams]);
  const defaultService = typeof servicio === "string" && Object.hasOwn(SERVICE_BY_PARAM, servicio) ? SERVICE_BY_PARAM[servicio] : undefined;

  return (
    <>
      <SiteHeader signedIn={!!user} overDark />
      <main className="bg-white">
        {/* Encabezado con foto, como el hero de la home */}
        <section className="relative isolate overflow-hidden pt-36 pb-48 text-white sm:pt-44">
          <Image src="/barcos/yate-mar-abierto.jpg" alt="" fill preload sizes="100vw" className="-z-20 object-cover object-[55%_60%]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,31,58,.82)_0%,rgba(18,58,107,.68)_55%,rgba(11,31,58,.86)_100%)]" />
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-[12.5px] font-medium tracking-[0.22em] text-sky-300 uppercase">Contacto</p>
            <h1 className="mt-4 max-w-2xl text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
              Contanos qué <span className="font-serif font-normal text-sky-300 italic">le pasa a tu barco.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/75">
              Te respondemos con los próximos pasos y, si hace falta, coordinamos una visita a tu amarre para el diagnóstico.
            </p>
          </div>
          <svg aria-hidden className="absolute inset-x-0 -bottom-px h-24 w-full text-[#e6f0fc]" viewBox="0 0 1440 96" preserveAspectRatio="none">
            <path d="M0 50 C240 10 480 90 720 50 S1200 10 1440 50 V96 H0 Z" fill="currentColor" />
          </svg>
        </section>

        {/* Datos y formulario sobre la carta náutica; el formulario sube sobre la foto */}
        <section className="relative isolate pt-px pb-24">
          <ChartBackground />
          <div className="mx-auto -mt-36 grid max-w-6xl items-start gap-6 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
            <ul className="order-2 grid content-start gap-3 lg:order-1">
              {CHANNELS.map(({ icon: Icon, label, value, href }) => (
                <li
                  key={label}
                  className="flex items-start gap-3.5 rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(11,31,58,0.45)]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-slate-500">{label}</p>
                    {href ? (
                      <a href={href} className="text-[15px] font-medium text-slate-900 hover:text-blue-700 hover:underline hover:underline-offset-4">
                        {value}
                      </a>
                    ) : (
                      <p className="text-[15px] font-medium text-slate-900">{value}</p>
                    )}
                  </div>
                </li>
              ))}
              <li className="mt-2 rounded-2xl bg-[linear-gradient(120deg,#0b1f3a,#123a6b)] p-5 text-white">
                <p className="text-[12.5px] font-medium text-sky-300">¿Es urgente?</p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-white/80">
                  Si el barco está por salir o tiene una avería, llamanos directamente al{" "}
                  <a href={company.phoneHref} className="font-medium text-white underline underline-offset-4">
                    {company.phone}
                  </a>
                  .
                </p>
              </li>
            </ul>

            <div className="order-1 lg:order-2">
              <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(11,31,58,0.55)] sm:p-8">
                <ContactForm defaultService={defaultService} />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
