import Link from "next/link";
import { ArrowRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonClasses } from "@/components/ui/button";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { brand, company } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden pt-16 pb-32 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 rotate-180" />
      <Reveal className="mx-auto max-w-3xl px-6">
        <RevealItem>
          <h2 className="text-[clamp(2.4rem,6vw,4.5rem)] leading-[1] font-semibold tracking-[-0.045em] text-balance">
            ¿Tu barco necesita <span className="font-serif font-normal italic">una revisión?</span>
          </h2>
        </RevealItem>
        <RevealItem>
          <p className="mx-auto mt-6 max-w-md text-[17px] text-muted-foreground">
            Contanos qué le pasa y te respondemos en menos de 24 horas laborables con los próximos pasos.
          </p>
        </RevealItem>
        <RevealItem>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/contacto" className={cn(buttonClasses("primary", "lg"), "group")}>
              Pedir presupuesto
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <a href={company.phoneHref} className={buttonClasses("secondary", "lg")}>
              <Phone className="size-4" />
              {company.phone}
            </a>
          </div>
        </RevealItem>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-xs text-[13px] text-muted-foreground">{brand.tagline}</p>
        </div>
        <ul className="grid content-start gap-2.5 text-[13px] text-muted-foreground">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>
              {company.address}
              <br />
              {company.city}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Phone className="size-4 shrink-0" strokeWidth={1.75} />
            <a href={company.phoneHref} className="hover:text-foreground">
              {company.phone}
            </a>
          </li>
          <li className="flex items-center gap-2">
            <Mail className="size-4 shrink-0" strokeWidth={1.75} />
            <a href={`mailto:${company.email}`} className="hover:text-foreground">
              {company.email}
            </a>
          </li>
          <li className="flex items-start gap-2">
            <Clock3 className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {company.hours}
          </li>
        </ul>
        <nav aria-label="Pie de página" className="grid content-start gap-2.5 text-[13px] text-muted-foreground">
          <Link href="/#servicios" className="hover:text-foreground">
            Servicios
          </Link>
          <Link href="/#empresa" className="hover:text-foreground">
            La empresa
          </Link>
          <Link href="/contacto" className="hover:text-foreground">
            Contacto
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Acceso empleados
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-6 py-5 text-[12.5px] text-muted-foreground">
          © {new Date().getFullYear()} {company.legalName}. Sitio demostrativo realizado para una prueba técnica.
        </p>
      </div>
    </footer>
  );
}
