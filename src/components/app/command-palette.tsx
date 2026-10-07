"use client";

import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { Building2, CalendarPlus, LogOut, MoonStar, Sparkles, Timer, UserPlus } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import type { Permission } from "@/lib/domain/permissions";
import { AssistantView } from "./assistant-view";
import { NAV, NAV_ICONS } from "./nav";

function Item({ children, onSelect, value, shortcut }: { children: ReactNode; onSelect: () => void; value: string; shortcut?: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13.5px] text-muted-foreground transition-colors data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
    >
      {children}
      {shortcut ? <span className="ml-auto font-mono text-[11px] text-muted-foreground">{shortcut}</span> : null}
    </Command.Item>
  );
}

const groupHeading =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase";

export function CommandPalette({
  orgId,
  permissions,
  organizations,
  aiEnabled = false,
}: {
  orgId: string;
  permissions: Permission[];
  organizations: { id: string; name: string }[];
  aiEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Pregunta en curso al asistente (null = modo búsqueda)
  const [asking, setAsking] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setAsking(null);
    setSearch("");
  };
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        setAsking(null);
      } else if (e.key === "Escape") {
        // Cierra siempre, esté donde esté el foco (también con el asistente abierto)
        setOpen(false);
        setAsking(null);
        setSearch("");
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  const run = (fn: () => void) => {
    close();
    fn();
  };
  const go = (path: string) => run(() => router.push(`/app/${orgId}/${path}`));

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[14vh]">
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[560px]"
          >
            {asking !== null ? (
              <div
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_32px_80px_-20px_rgb(0_0_0/0.45)]"
                onKeyDown={(e) => e.key === "Escape" && close()}
              >
                <AssistantView orgId={orgId} initialQuestion={asking} onBack={() => setAsking(null)} />
              </div>
            ) : (
              <Command
                label="Paleta de comandos"
                loop
                onKeyDown={(e) => e.key === "Escape" && close()}
                className={`overflow-hidden rounded-2xl border border-border bg-card shadow-[0_32px_80px_-20px_rgb(0_0_0/0.45)] ${groupHeading}`}
              >
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder={aiEnabled ? "Buscá una página o preguntale algo al asistente…" : "Buscá una página o acción…"}
                  className="h-14 w-full border-b border-border bg-transparent px-5 text-[15px] outline-none placeholder:text-muted-foreground"
                />
                <Command.List className="max-h-[360px] overflow-y-auto p-2">
                  <Command.Empty className="py-10 text-center text-[13px] text-muted-foreground">Sin resultados.</Command.Empty>

                  {search.trim().length >= 3 ? (
                    <Command.Group heading="Asistente IA" forceMount>
                      <Command.Item
                        value={`__ia__ ${search}`}
                        forceMount
                        disabled={!aiEnabled}
                        onSelect={() => setAsking(search.trim())}
                        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] text-muted-foreground transition-colors data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60 data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                      >
                        <Sparkles className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                        {aiEnabled ? (
                          <span className="truncate">
                            Preguntarle al asistente: <span className="text-foreground">“{search.trim()}”</span>
                          </span>
                        ) : (
                          <span>El asistente IA no está activado (falta OPENROUTER_API_KEY)</span>
                        )}
                      </Command.Item>
                    </Command.Group>
                  ) : null}

                  <Command.Group heading="Acciones">
                    <Item value="fichar entrada salida reloj" onSelect={() => go("time-tracking")}>
                      <Timer className="size-4" strokeWidth={1.75} /> Fichar entrada / salida
                    </Item>
                    <Item value="solicitar vacaciones ausencia" onSelect={() => go("vacations")}>
                      <CalendarPlus className="size-4" strokeWidth={1.75} /> Solicitar vacaciones
                    </Item>
                    {permissions.includes("employees.manage") ? (
                      <Item value="invitar empleado miembro" onSelect={() => go("employees")}>
                        <UserPlus className="size-4" strokeWidth={1.75} /> Invitar a alguien
                      </Item>
                    ) : null}
                  </Command.Group>

                  <Command.Group heading="Ir a">
                    {NAV.filter((n) => !n.permission || permissions.includes(n.permission)).map((n) => {
                      const Icon = NAV_ICONS[n.icon];
                      return (
                        <Item key={n.href} value={`${n.label} ${n.keywords?.join(" ") ?? ""}`} onSelect={() => go(n.href)}>
                          <Icon className="size-4" strokeWidth={1.75} /> {n.label}
                        </Item>
                      );
                    })}
                  </Command.Group>

                  {organizations.length > 1 ? (
                    <Command.Group heading="Organizaciones">
                      {organizations
                        .filter((o) => o.id !== orgId)
                        .map((o) => (
                          <Item key={o.id} value={`cambiar a ${o.name}`} onSelect={() => run(() => router.push(`/app/${o.id}/dashboard`))}>
                            <Building2 className="size-4" strokeWidth={1.75} /> Cambiar a {o.name}
                          </Item>
                        ))}
                    </Command.Group>
                  ) : null}

                  <Command.Group heading="Preferencias">
                    <Item
                      value="tema oscuro claro apariencia"
                      onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
                    >
                      <MoonStar className="size-4" strokeWidth={1.75} /> Cambiar tema
                    </Item>
                    <Item value="cerrar sesión salir logout" onSelect={() => run(() => void signOut())}>
                      <LogOut className="size-4" strokeWidth={1.75} /> Cerrar sesión
                    </Item>
                  </Command.Group>
                </Command.List>
                <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11.5px] text-muted-foreground">
                  <span>
                    <kbd className="font-mono">↑↓</kbd> navegar
                  </span>
                  <span>
                    <kbd className="font-mono">↵</kbd> abrir
                  </span>
                  <span>
                    <kbd className="font-mono">esc</kbd> cerrar
                  </span>
                </div>
              </Command>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
