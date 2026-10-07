"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, ChevronsUpDown, LogOut, Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Avatar } from "@/components/ui/avatar";
import { isRole, ROLE_LABEL, type Permission, type Role } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { NAV, NAV_ICONS } from "./nav";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface ShellProps {
  orgId: string;
  orgName: string;
  role: Role;
  permissions: Permission[];
  user: { name: string; email: string; position: string | null };
  organizations: { id: string; name: string; role: string }[];
  /** Contadores de la navegación (pendientes + avisos sin leer) */
  badges?: { inbox?: number; forum?: number };
  /** La IA está configurada en el servidor (OPENROUTER_API_KEY) */
  aiEnabled?: boolean;
  children: ReactNode;
}

function OrgSwitcher({ orgId, orgName, role, organizations }: Pick<ShellProps, "orgId" | "orgName" | "role" | "organizations">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Instalación de una sola empresa: la marca es un encabezado fijo. El selector
  // solo aparece si alguien pertenece a más de una organización.
  const multiple = organizations.length > 1;
  const brand = (
    <>
      <div className="min-w-0 flex-1">
        {/* Instalación de Diplonautic: el logo oficial; con otra empresa, su nombre */}
        {orgName === "Diplonautic" ? (
          <Image src="/logo/diplonautic-claro.png" alt="Diplonautic" width={566} height={96} className="h-6 w-auto" />
        ) : (
          <p className="truncate text-[14px] font-semibold tracking-tight text-white">{orgName}</p>
        )}
        <p className="mt-1.5 text-[11.5px] text-white/55">Intranet · {ROLE_LABEL[role]}</p>
      </div>
    </>
  );

  if (!multiple) return <div className="flex items-center gap-3 p-2">{brand}</div>;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5"
      >
        {brand}
        <ChevronsUpDown className="size-4 text-white/50" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-x-0 top-full z-50 mt-1 origin-top rounded-xl border border-border bg-card p-1 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.25)]"
          >
            {organizations.map((o) => (
              <Link
                key={o.id}
                href={`/app/${o.id}/dashboard`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors hover:bg-muted"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-muted text-[11px] font-semibold">
                  {o.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 truncate">{o.name}</span>
                <span className="text-[11px] text-muted-foreground">{isRole(o.role) ? ROLE_LABEL[o.role] : o.role}</span>
                {o.id === orgId ? <Check className="size-3.5 text-accent" /> : null}
              </Link>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarContent({ props, onNavigate }: { props: ShellProps; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.permission || props.permissions.includes(n.permission));

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <OrgSwitcher {...props} />

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[13px] text-white/55 transition-colors hover:border-white/20 hover:text-white"
      >
        <Search className="size-4" strokeWidth={1.75} />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 font-mono text-[10.5px]">⌘K</kbd>
      </button>

      <nav className="grid gap-0.5" aria-label="Principal">
        {items.map((item) => {
          const href = `/app/${props.orgId}/${item.href}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = NAV_ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] transition-colors",
                active ? "font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
              )}
            >
              {active ? (
                <motion.span
                  layoutId={onNavigate ? "nav-pill-mobile" : "nav-pill"}
                  className="absolute inset-0 rounded-xl bg-white/10 shadow-[inset_3px_0_0_0_#7dd3fc]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <Icon className="relative size-[18px]" strokeWidth={active ? 2 : 1.75} />
              <span className="relative flex-1">{item.label}</span>
              {item.badge && props.badges?.[item.badge] ? (
                <span className="relative min-w-5 rounded-full bg-blue-500 px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular">
                  {props.badges[item.badge]! > 99 ? "99+" : props.badges[item.badge]}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-2">
        <div className="flex items-center gap-3 rounded-xl border-t border-white/10 p-2 pt-4">
          <Avatar name={props.user.name} size={32} className="ring-[#0b1f3a]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{props.user.name}</p>
            <p className="truncate text-[11.5px] text-white/55">{props.user.position ?? props.user.email}</p>
          </div>
          <ThemeToggle className="size-8 text-white/60 hover:bg-white/10 hover:text-white" />
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="inline-flex size-8 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell(props: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh bg-[#0b1f3a] lg:block dark:bg-[#081527]">
        <SidebarContent props={props} />
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[#0b1f3a] px-4 text-white lg:hidden">
        <div className="flex items-center gap-2.5">
          <LogoMark inverted className="size-7" />
          <span className="max-w-[180px] truncate text-[14px] font-semibold">{props.orgName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/app/${props.orgId}/inbox`}
            aria-label={props.badges?.inbox ? `Bandeja: ${props.badges.inbox} pendientes` : "Bandeja"}
            className="relative inline-flex size-9 items-center justify-center rounded-xl hover:bg-white/10"
          >
            <Bell className="size-5" strokeWidth={1.75} />
            {props.badges?.inbox ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-400 ring-2 ring-[#0b1f3a]" />
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="inline-flex size-9 items-center justify-center rounded-xl hover:bg-white/10"
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[290px] bg-[#0b1f3a] lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="absolute top-4 -right-12 inline-flex size-9 items-center justify-center rounded-xl bg-background"
              >
                <X className="size-5" />
              </button>
              <SidebarContent props={props} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className="min-w-0">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10"
        >
          {props.children}
        </motion.div>
      </main>

      <CommandPalette orgId={props.orgId} permissions={props.permissions} organizations={props.organizations} aiEnabled={props.aiEnabled} />
    </div>
  );
}
