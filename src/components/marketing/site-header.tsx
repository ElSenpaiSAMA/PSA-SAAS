"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#producto", label: "Producto" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#seguridad", label: "Seguridad" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

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
          scrolled
            ? "border border-border bg-background/70 shadow-[0_8px_32px_-12px_rgb(0_0_0/0.15)] backdrop-blur-xl"
            : "border border-transparent",
        )}
      >
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/select-organization" className={buttonClasses("primary", "sm")}>
              Ir a la app
            </Link>
          ) : (
            <>
              <Link href="/login" className={cn(buttonClasses("ghost", "sm"), "hidden sm:inline-flex")}>
                Iniciar sesión
              </Link>
              <Link href="/signup" className={buttonClasses("primary", "sm")}>
                Empezar
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
