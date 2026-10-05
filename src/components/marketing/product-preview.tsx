"use client";

import { CalendarDays, Check, Clock3, FolderKanban, LayoutDashboard, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { AnimatedNumber, ProgressBar } from "@/components/ui/motion";

const EASE = [0.16, 1, 0.3, 1] as const;

function useTicker(startSeconds: number) {
  const [s, setS] = useState(startSeconds);
  useEffect(() => {
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const projects = [
  { name: "Rediseño portal clientes", used: 214, budget: 320 },
  { name: "API de pagos v2", used: 168, budget: 200 },
  { name: "Onboarding interno", used: 22, budget: 60 },
];

export function ProductPreview() {
  const time = useTicker(3 * 3600 + 42 * 60 + 11);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_40px_120px_-40px_rgb(0_0_0/0.45)]">
        {/* barra de ventana */}
        <div className="flex h-10 items-center gap-2 border-b border-border px-4">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <div className="mx-auto hidden h-6 w-64 items-center justify-center rounded-md bg-muted text-[11px] text-muted-foreground sm:flex">
            app.kairos.io/nebula/dashboard
          </div>
        </div>

        <div className="flex">
          {/* sidebar */}
          <aside className="hidden w-48 shrink-0 border-r border-border p-3 md:block">
            <div className="mb-4 flex items-center gap-2 px-2">
              <LogoMark className="size-5" />
              <span className="text-[13px] font-semibold">Nébula Studio</span>
            </div>
            {[
              { icon: LayoutDashboard, label: "Inicio", active: true },
              { icon: Clock3, label: "Fichaje" },
              { icon: CalendarDays, label: "Vacaciones" },
              { icon: FolderKanban, label: "Proyectos" },
              { icon: Users, label: "Equipo" },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] ${
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                {label}
              </div>
            ))}
          </aside>

          {/* contenido */}
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11.5px] text-muted-foreground">Lunes, 5 de octubre</p>
                <p className="text-lg font-semibold tracking-tight">Buenos días, Ana</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                <span className="font-mono text-[13px] tabular">{time}</span>
                <span className="rounded-md bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">
                  Fichar salida
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {[
                { label: "Horas semana", value: 32.25, fmt: (n: number) => `${Math.floor(n)}h ${String(Math.round((n % 1) * 60)).padStart(2, "0")}m` },
                { label: "Carga", value: 81, fmt: (n: number) => `${Math.round(n)}%` },
                { label: "Vacaciones", value: 15, fmt: (n: number) => `${Math.round(n)} días` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10.5px] text-muted-foreground sm:text-[11.5px]">{s.label}</p>
                  <AnimatedNumber value={s.value} format={s.fmt} className="text-[15px] font-semibold tracking-tight sm:text-xl" />
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-[12px] font-medium">Horas por proyecto</p>
              <div className="grid gap-3">
                {projects.map((p) => (
                  <div key={p.name} className="grid gap-1.5">
                    <div className="flex justify-between text-[11.5px]">
                      <span className="truncate text-muted-foreground">{p.name}</span>
                      <span className="tabular text-muted-foreground">
                        {p.used}/{p.budget}h
                      </span>
                    </div>
                    <ProgressBar value={p.used} max={p.budget} tone={p.used / p.budget > 0.8 ? "warning" : "accent"} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* notificación flotante */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.4, duration: 0.9, ease: EASE }}
        className="absolute -right-3 -bottom-6 hidden w-72 rounded-2xl border border-border bg-card/90 p-3.5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)] backdrop-blur-xl sm:block lg:-right-10"
      >
        <div className="flex gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="size-4" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium">Vacaciones aprobadas</p>
            <p className="text-[12px] text-muted-foreground">Carlos aprobó 5 días · 26–30 oct</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
