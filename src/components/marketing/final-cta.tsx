import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonClasses } from "@/components/ui/button";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden pt-16 pb-32 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 rotate-180" />
      <Reveal className="mx-auto max-w-3xl px-6">
        <RevealItem>
          <h2 className="text-[clamp(2.4rem,6vw,4.5rem)] leading-[1] font-semibold tracking-[-0.045em] text-balance">
            Tu equipo merece <span className="font-serif font-normal italic">mejores herramientas.</span>
          </h2>
        </RevealItem>
        <RevealItem>
          <p className="mx-auto mt-6 max-w-md text-[17px] text-muted-foreground">
            Creá tu organización en dos minutos. Sin tarjeta, sin instalaciones.
          </p>
        </RevealItem>
        <RevealItem>
          <div className="mt-10 flex justify-center gap-3">
            <Link href="/signup" className={cn(buttonClasses("primary", "lg"), "group")}>
              Empezar ahora
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </RevealItem>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div className="grid gap-2">
          <Logo />
          <p className="text-[13px] text-muted-foreground">{brand.tagline}</p>
        </div>
        <p className="text-[13px] text-muted-foreground">
          © {new Date().getFullYear()} {brand.name}. Proyecto demostrativo.
        </p>
      </div>
    </footer>
  );
}
