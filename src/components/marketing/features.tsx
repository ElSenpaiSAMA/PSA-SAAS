"use client";

import { Building2, CalendarCheck2, Clock3, FolderKanban, GitBranch, ScrollText } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { Reveal, RevealItem } from "@/components/ui/motion";
import { SpotlightCard } from "./spotlight-card";

const EASE = [0.16, 1, 0.3, 1] as const;

function FeatureCopy({ icon: Icon, title, text }: { icon: typeof Clock3; title: string; text: string }) {
  return (
    <div className="relative">
      <div className="mb-4 flex size-9 items-center justify-center rounded-xl border border-border bg-background">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </div>
      <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function ClockDemo() {
  return (
    <div className="relative mt-8 flex items-center gap-4">
      <motion.button
        type="button"
        tabIndex={-1}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="relative flex size-20 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
      >
        <span className="absolute inset-0 animate-pulse-ring rounded-full" />
        <span className="text-[13px] font-medium">Fichar</span>
      </motion.button>
      <div className="grid gap-1.5">
        {["09:02 Entrada", "13:30 Pausa", "14:15 Vuelta"].map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.6, ease: EASE }}
            className="font-mono text-[12.5px] text-muted-foreground"
          >
            {t}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function HierarchyDemo() {
  // Coordenadas en % del contenedor: el centro del avatar cae exactamente en (x, y)
  const people = [
    { name: "Laura Méndez", role: "Owner", x: 50, y: 12 },
    { name: "Carlos Ruiz", role: "Manager", x: 27, y: 46 },
    { name: "Sofía Navarro", role: "Admin", x: 73, y: 46 },
    { name: "Ana Torres", role: "Empleada", x: 14, y: 80 },
    { name: "Diego Fernández", role: "Empleado", x: 40, y: 80 },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
  ];
  return (
    <div className="relative mt-8 h-48">
      <svg className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
        {edges
          .map(([a, b]) => `M${people[a].x} ${people[a].y} L${people[b].x} ${people[b].y}`)
          .map((d, i) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.12, duration: 0.8, ease: EASE }}
          />
        ))}
      </svg>
      {people.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.6, ease: EASE }}
          className="absolute size-[30px] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        >
          <Avatar name={p.name} size={30} className="ring-card" />
          <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 text-[10.5px] whitespace-nowrap text-muted-foreground">
            {p.role}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function AuditDemo() {
  const lines = [
    { who: "Carlos", what: "aprobó vacaciones de Diego", t: "hace 2 min" },
    { who: "Ana", what: "cerró fichaje · 8h 05m", t: "hace 14 min" },
    { who: "Sofía", what: "invitó a marta@nebula.io", t: "hace 1 h" },
    { who: "Laura", what: "creó el proyecto API v2", t: "ayer" },
  ];
  return (
    <div className="mt-8 grid gap-2">
      {lines.map((l, i) => (
        <motion.div
          key={l.what}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.6, ease: EASE }}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-[12.5px]"
        >
          <span className="truncate">
            <span className="font-medium">{l.who}</span> <span className="text-muted-foreground">{l.what}</span>
          </span>
          <span className="shrink-0 text-muted-foreground">{l.t}</span>
        </motion.div>
      ))}
    </div>
  );
}

function OrgSwitchDemo() {
  return (
    <div className="mt-8 grid gap-2">
      {[
        { name: "Nébula Studio", role: "Owner" },
        { name: "Orbital Labs", role: "Advisor" },
      ].map((o, i) => (
        <motion.div
          key={o.name}
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.15, duration: 0.6, ease: EASE }}
          className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
        >
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-[12px] font-semibold">
            {o.name[0]}
          </div>
          <span className="text-[13px] font-medium">{o.name}</span>
          <span className="ml-auto text-[12px] text-muted-foreground">{o.role}</span>
        </motion.div>
      ))}
    </div>
  );
}

export function Features() {
  return (
    <section id="producto" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <RevealItem>
            <p className="mb-4 text-[13px] font-medium text-accent">Producto</p>
          </RevealItem>
          <RevealItem>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
              Todo lo que pasa con el tiempo de tu equipo,{" "}
              <span className="font-serif font-normal italic">sin hojas de cálculo.</span>
            </h2>
          </RevealItem>
        </Reveal>

        <Reveal className="grid gap-4 md:grid-cols-6" stagger={0.1}>
          <RevealItem className="md:col-span-3">
            <SpotlightCard className="h-full p-7">
              <FeatureCopy
                icon={Clock3}
                title="Fichaje en un clic"
                text="Entrada y salida desde el móvil o el escritorio. Inmutable una vez registrado: nadie reescribe su hora de entrada."
              />
              <ClockDemo />
            </SpotlightCard>
          </RevealItem>

          <RevealItem className="md:col-span-3">
            <SpotlightCard className="h-full p-7">
              <FeatureCopy
                icon={FolderKanban}
                title="Horas por proyecto"
                text="Cada hora se imputa a una tarea. Compará lo presupuestado con lo real y detectá sobrecarga antes de que sea un problema."
              />
              <div className="mt-8 grid gap-3">
                {[
                  { label: "Portal clientes", pct: 67 },
                  { label: "API de pagos v2", pct: 84 },
                  { label: "Onboarding", pct: 37 },
                ].map((b, i) => (
                  <div key={b.label} className="grid gap-1.5">
                    <div className="flex justify-between text-[12.5px] text-muted-foreground">
                      <span>{b.label}</span>
                      <span className="tabular">{b.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={b.pct > 80 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-accent"}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${b.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + i * 0.12, duration: 1.1, ease: EASE }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </RevealItem>

          <RevealItem className="md:col-span-2">
            <SpotlightCard className="h-full p-7">
              <FeatureCopy
                icon={CalendarCheck2}
                title="Vacaciones con aprobación"
                text="El pedido llega al manager correcto según el organigrama. Saldo en días hábiles, calculado, nunca desincronizado."
              />
              <div className="mt-8 flex items-center gap-2 text-[12.5px]">
                {["Solicitada", "Manager", "Aprobada"].map((s, i) => (
                  <motion.div
                    key={s}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.25, duration: 0.5, ease: EASE }}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={
                        i === 2
                          ? "rounded-full bg-success/12 px-2.5 py-1 font-medium text-success"
                          : "rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
                      }
                    >
                      {s}
                    </span>
                    {i < 2 ? <span className="text-border-strong">→</span> : null}
                  </motion.div>
                ))}
              </div>
            </SpotlightCard>
          </RevealItem>

          <RevealItem className="md:col-span-2">
            <SpotlightCard className="h-full p-7">
              <FeatureCopy
                icon={GitBranch}
                title="Jerarquía y permisos"
                text="Owner, admin, manager, empleado. Cada rango ve y hace exactamente lo que le corresponde."
              />
              <HierarchyDemo />
            </SpotlightCard>
          </RevealItem>

          <RevealItem className="md:col-span-2">
            <SpotlightCard className="h-full p-7">
              <FeatureCopy
                icon={Building2}
                title="Multi-empresa"
                text="Una cuenta, varias organizaciones, roles distintos en cada una. Los datos nunca se cruzan."
              />
              <OrgSwitchDemo />
            </SpotlightCard>
          </RevealItem>

          <RevealItem className="md:col-span-6">
            <SpotlightCard className="grid gap-2 p-7 md:grid-cols-2 md:items-center md:gap-10">
              <FeatureCopy
                icon={ScrollText}
                title="Auditoría completa"
                text="Cada alta, cambio de rol, fichaje, aprobación o tarea queda registrada con quién, qué y cuándo. Inmutable desde la aplicación."
              />
              <AuditDemo />
            </SpotlightCard>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
