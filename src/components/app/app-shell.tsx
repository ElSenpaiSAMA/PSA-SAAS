"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, ChevronDown, ChevronsUpDown, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { signOut } from "@/app/(auth)/actions";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Avatar } from "@/components/ui/avatar";
import { isRole, ROLE_LABEL, type Permission, type Role } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { NAV, NAV_GROUPS, NAV_ICONS, visibleNav } from "./nav";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface ShellProps {
  orgId: string;
  orgName: string;
  role: Role;
  permissions: Permission[];
  user: { name: string; email: string; position: string | null; avatar: string | null };
  organizations: { id: string; name: string; role: string }[];
  /** Contadores de la navegación (pendientes + avisos sin leer) */
  badges?: { inbox?: number; forum?: number; contact?: number };
  /** La IA está configurada en el servidor (OPENROUTER_API_KEY) */
  aiEnabled?: boolean;
  children: ReactNode;
}

/** Cierra un menú desplegable al hacer click afuera o con Escape. */
function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}

const menuMotion = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.18, ease: EASE },
};

/** Bloque de la empresa al pie de la barra lateral. Con más de una organización, abre el selector. */
function Workspace({ orgId, orgName, role, organizations }: Pick<ShellProps, "orgId" | "orgName" | "role" | "organizations">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  const multiple = organizations.length > 1;

  const block = (
    <>
      <LogoMark inverted className="size-9" />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13.5px] font-semibold text-white">{orgName}</p>
        <p className="text-[11.5px] text-white/55">Intranet · {ROLE_LABEL[role]}</p>
      </div>
    </>
  );

  if (!multiple) return <div className="flex items-center gap-3 rounded-xl p-2">{block}</div>;

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open ? (
          <motion.div
            {...menuMotion}
            className="absolute inset-x-0 bottom-full z-50 mb-1 origin-bottom rounded-xl border border-border bg-card p-1 text-foreground shadow-[0_16px_48px_-12px_rgb(0_0_0/0.35)]"
          >
            {organizations.map((o) => (
              <Link
                key={o.id}
                href={`/app/${o.id}/dashboard`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors hover:bg-muted"
              >
                <span className="flex-1 truncate">{o.name}</span>
                <span className="text-[11px] text-muted-foreground">{isRole(o.role) ? ROLE_LABEL[o.role] : o.role}</span>
                {o.id === orgId ? <Check className="size-3.5 text-accent" /> : null}
              </Link>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5"
      >
        {block}
        <ChevronsUpDown className="size-4 text-white/50" />
      </button>
    </div>
  );
}

function SidebarContent({ props, onNavigate }: { props: ShellProps; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = visibleNav(props.permissions);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Link
          href={`/app/${props.orgId}/dashboard`}
          onClick={onNavigate}
          aria-label={`${props.orgName} OS: ir al inicio`}
          className="flex items-center gap-2.5"
        >
          {props.orgName === "Diplonautic" ? (
            <Image src="/logo/diplonautic-claro.png" alt="Diplonautic" width={566} height={96} className="h-6 w-auto" />
          ) : (
            <span className="text-[15px] font-semibold text-white">{props.orgName}</span>
          )}
          {/* El sistema interno de la empresa: "Diplonautic OS", como parte de la marca */}
          <span aria-hidden className="h-4 w-px bg-white/25" />
          <span className="text-[14px] leading-none font-medium tracking-[0.14em] text-sky-300">OS</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Principal">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.08em] text-white/40 uppercase">{group}</p>
              <div className="grid gap-0.5">
                {groupItems.map((item) => {
                  const href = `/app/${props.orgId}/${item.href}`;
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const Icon = NAV_ICONS[item.icon];
                  const count = item.badge ? props.badges?.[item.badge] : undefined;
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
                      {count ? (
                        <span className="relative min-w-5 rounded-full bg-blue-500 px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular">
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <Workspace {...props} />
      </div>
    </div>
  );
}

/** Avatar de la barra superior: nombre, puesto, acceso a "Mi perfil" y cerrar sesión. */
function UserMenu({ orgId, user }: { orgId: string; user: ShellProps["user"] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Menú de usuario"
        className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-muted"
      >
        <Avatar name={user.name} src={user.avatar} size={30} />
        <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            {...menuMotion}
            className="absolute top-full right-0 z-50 mt-1 w-60 origin-top-right rounded-xl border border-border bg-card p-1 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.25)]"
          >
            <Link
              href={`/app/${orgId}/profile`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <Avatar name={user.name} src={user.avatar} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium">{user.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{user.position ?? user.email}</span>
              </span>
            </Link>
            <div className="my-1 h-px bg-border" />
            <Link
              href={`/app/${orgId}/profile`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <UserRound className="size-4" strokeWidth={1.75} />
              Mi perfil
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
                Cerrar sesión
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Barra superior: dónde estoy, buscador, avisos, tema y usuario. */
function Topbar({ props, onMenu }: { props: ShellProps; onMenu: () => void }) {
  const pathname = usePathname();
  // "Mi perfil" no está en el menú lateral: se entra desde el avatar
  const current =
    pathname === `/app/${props.orgId}/profile`
      ? { group: "Cuenta", label: "Mi perfil" }
      : NAV.find((n) => {
          const href = `/app/${props.orgId}/${n.href}`;
          return pathname === href || pathname.startsWith(`${href}/`);
        });
  const inbox = props.badges?.inbox ?? 0;

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Abrir menú"
        className="inline-flex size-9 items-center justify-center rounded-xl hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.75} />
      </button>
      <LogoMark className="size-7 lg:hidden" />

      <p className="hidden min-w-0 items-center gap-2 text-[13.5px] sm:flex">
        {current ? (
          <>
            <span className="text-muted-foreground">{current.group}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate font-medium">{current.label}</span>
          </>
        ) : null}
      </p>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="hidden h-9 w-56 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground md:flex"
        >
          <Search className="size-4" strokeWidth={1.75} />
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 font-mono text-[10.5px]">⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          aria-label="Buscar"
          className="inline-flex size-9 items-center justify-center rounded-xl hover:bg-muted md:hidden"
        >
          <Search className="size-[18px]" strokeWidth={1.75} />
        </button>
        <Link
          href={`/app/${props.orgId}/inbox`}
          aria-label={inbox ? `Bandeja: ${inbox} pendientes` : "Bandeja"}
          className="relative inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          {inbox ? <span className="absolute top-2 right-2 size-2 rounded-full bg-blue-500 ring-2 ring-background" /> : null}
        </Link>
        <ThemeToggle />
        <UserMenu orgId={props.orgId} user={props.user} />
      </div>
    </header>
  );
}

export function AppShell(props: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    // En escritorio el marco ocupa justo la pantalla: barra lateral, barra superior y un
    // contenedor de tamaño fijo que hace scroll por dentro (no crece con el contenido).
    // En móvil se mantiene el scroll normal de la página.
    <div className="min-h-dvh bg-background lg:grid lg:h-dvh lg:grid-cols-[260px_1fr] lg:overflow-hidden">
      <aside className="sticky top-0 hidden h-dvh bg-[#0b1f3a] lg:block dark:bg-[#081527]">
        <SidebarContent props={props} />
      </aside>

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

      <div className="min-w-0 lg:flex lg:h-dvh lg:flex-col">
        <Topbar props={props} onMenu={() => setMobileOpen(true)} />
        <main className="p-3 sm:p-5 lg:min-h-0 lg:flex-1">
          {/* Contenedor de la página: las tarjetas van adentro, no sueltas en el espacio */}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="overflow-hidden rounded-[22px] border border-border bg-muted/60 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.6)] lg:h-full dark:bg-muted/30 dark:shadow-none"
          >
            {/* Al cambiar de página el contenedor se vuelve a montar: el scroll arranca arriba */}
            <div className="p-4 sm:p-7 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable]">
              <div className="mx-auto max-w-[1400px] lg:h-full">{props.children}</div>
            </div>
          </motion.div>
        </main>
      </div>

      <CommandPalette orgId={props.orgId} permissions={props.permissions} organizations={props.organizations} aiEnabled={props.aiEnabled} />
    </div>
  );
}
