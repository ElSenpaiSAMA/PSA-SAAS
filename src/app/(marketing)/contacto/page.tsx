import type { Metadata } from "next";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import { SiteFooter } from "@/components/marketing/final-cta";
import { SiteHeader } from "@/components/marketing/site-header";
import { company } from "@/lib/brand";
import { getUser } from "@/lib/data/session";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Pedí presupuesto para la reparación o el mantenimiento de tu barco.",
};

const CHANNELS = [
  { icon: Phone, label: "Teléfono", value: company.phone, href: company.phoneHref },
  { icon: Mail, label: "Email", value: company.email, href: `mailto:${company.email}` },
  { icon: MapPin, label: "Taller", value: `${company.address}, ${company.city}` },
  { icon: Clock3, label: "Horario", value: company.hours },
];

export default async function ContactPage() {
  const user = await getUser();

  return (
    <>
      <SiteHeader signedIn={!!user} />
      <main className="relative overflow-hidden pt-32 pb-24 sm:pt-40">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="text-[13px] font-medium text-accent">Contacto</p>
            <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
              Contanos qué <span className="font-serif font-normal italic">le pasa a tu barco.</span>
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted-foreground">
              Te respondemos con los próximos pasos y, si hace falta, coordinamos una visita para el diagnóstico.
            </p>

            <ul className="mt-10 grid gap-3">
              {CHANNELS.map(({ icon: Icon, label, value, href }) => (
                <li key={label} className="flex items-start gap-3.5 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-muted-foreground">{label}</p>
                    {href ? (
                      <a href={href} className="text-[14.5px] font-medium hover:underline hover:underline-offset-4">
                        {value}
                      </a>
                    ) : (
                      <p className="text-[14.5px] font-medium">{value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.3)] sm:p-8">
            <ContactForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
