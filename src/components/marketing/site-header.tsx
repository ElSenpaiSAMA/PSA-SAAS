"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Rutas absolutas ("/#…"): el header se usa también en /contacto, /diplonautic y /electromotor
const links = [
  { href: "/#servicios", label: "Servicios" },
  // Empresa y Cómo trabajamos se ocultan en pantallas medianas para que el menú entre en una línea
  { href: "/#empresa", label: "Empresa", wide: true },
  { href: "/#proceso", label: "Cómo trabajamos", wide: true },
  { href: "/diplonautic", label: "Diplonautic" },
  { href: "/electromotor", label: "ElectroMotor" },
  { href: "/contacto", label: "Contacto" },
];

/**
 * Al hacer scroll el header va siempre sobre vidrio azul marino, como en la home.
 * `overDark`: la página empieza con una foto oscura, así que arriba del todo también va en blanco.
 */
export function SiteHeader({
  signedIn,
  overDark = false,
}: {
  signedIn: boolean;
  overDark?: boolean;
}) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));
  // Menú del celular: en pantallas chicas los links no entran en la barra
  const [open, setOpen] = useState(false);
  const light = overDark || scrolled || open;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3"
    >
      <div
        className={cn(
          "relative flex h-14 w-full max-w-6xl items-center justify-between rounded-2xl px-3 pl-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          !scrolled && !open
            ? "border border-transparent"
            : "border border-white/10 bg-[#0b1f3a]/92 shadow-[0_12px_40px_-14px_rgba(11,31,58,0.6)] backdrop-blur-xl",
          light && "text-white",
        )}
      >
        <Logo inverted={light} />
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Principal"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13.5px] whitespace-nowrap transition-colors",
                "wide" in l && l.wide && "hidden lg:inline-block",
                light
                  ? "text-white/80 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <Link
              href="/select-organization"
              className={cn(
                buttonClasses("primary", "sm"),
                "bg-blue-600 text-white hover:bg-blue-500",
              )}
            >
              Ir a la intranet
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonClasses("ghost", "sm"),
                  "hidden sm:inline-flex",
                  light && "text-white/85 hover:bg-white/10 hover:text-white",
                )}
              >
                <span className="sm:hidden">Acceso</span>
                <span className="hidden sm:inline">Acceso empleados</span>
              </Link>
              <Link
                href="/contacto"
                className={cn(
                  buttonClasses("primary", "sm"),
                  "bg-blue-600 text-white hover:bg-blue-500",
                )}
              >
                <span className="sm:hidden">Presupuesto</span>
                <span className="hidden sm:inline">Pedir presupuesto</span>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className={cn(
              "grid size-9 place-items-center rounded-xl transition-colors md:hidden",
              light
                ? "text-white hover:bg-white/10"
                : "text-slate-700 hover:bg-slate-900/5",
            )}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.nav
              id="menu-movil"
              aria-label="Menú"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 top-full mt-2 grid gap-0.5 rounded-2xl border border-white/10 bg-[#0b1f3a]/95 p-2 shadow-[0_24px_50px_-20px_rgba(11,31,58,0.7)] backdrop-blur-xl md:hidden"
            >
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-[15px] text-white/85 hover:bg-white/10 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
              {!signedIn ? (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-1 rounded-xl border-t border-white/10 px-4 py-3 text-[15px] text-sky-300 hover:bg-white/10"
                >
                  Acceso empleados
                </Link>
              ) : null}
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
