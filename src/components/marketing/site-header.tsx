"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Rutas absolutas ("/#…"): el header se usa también en /contacto
const links = [
  { href: "/#servicios", label: "Servicios" },
  { href: "/#empresa", label: "Empresa" },
  { href: "/#proceso", label: "Cómo trabajamos" },
  { href: "/contacto", label: "Contacto" },
];

/** `overDark`: la página empieza con una foto oscura; el header va en blanco y, al hacer scroll, sobre vidrio azul marino. */
export function SiteHeader({ signedIn, overDark = false }: { signedIn: boolean; overDark?: boolean }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));
  const light = overDark;

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3"
    >
      <div
        className={cn(
          "flex h-14 w-full max-w-6xl items-center justify-between rounded-2xl px-3 pl-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          !scrolled
            ? "border border-transparent"
            : overDark
              ? "border border-white/10 bg-[#0b1f3a]/92 shadow-[0_12px_40px_-14px_rgba(11,31,58,0.6)] backdrop-blur-xl"
              : "border border-border bg-background/70 shadow-[0_8px_32px_-12px_rgb(0_0_0/0.15)] backdrop-blur-xl",
          light && "text-white",
        )}
      >
        <Logo inverted={light} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13.5px] transition-colors",
                light ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <Link href="/select-organization" className={cn(buttonClasses("primary", "sm"), "bg-blue-600 text-white hover:bg-blue-500")}>
              Ir a la intranet
            </Link>
          ) : (
            <>
              <Link href="/login" className={cn(buttonClasses("ghost", "sm"), light && "text-white/85 hover:bg-white/10 hover:text-white")}>
                <span className="sm:hidden">Acceso</span>
                <span className="hidden sm:inline">Acceso empleados</span>
              </Link>
              <Link href="/contacto" className={cn(buttonClasses("primary", "sm"), "bg-blue-600 text-white hover:bg-blue-500")}>
                <span className="sm:hidden">Presupuesto</span>
                <span className="hidden sm:inline">Pedir presupuesto</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
