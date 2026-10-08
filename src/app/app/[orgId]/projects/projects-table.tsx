"use client";

import Link from "next/link";
import { ArrowUpRight, FolderKanban, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ProjectRow {
  id: string;
  name: string;
  client: string | null;
  department: string;
  status: "active" | "archived";
  budgetedHours: number | null;
  loggedHours: number;
  tasksDone: number;
  tasksTotal: number;
  mine: number;
  openWorkOrders: number;
  team: string[];
}

type Health = { label: string; tone: BadgeTone };

/** Salud del proyecto según cuánto del presupuesto de horas ya se consumió. */
function health(p: ProjectRow): Health {
  if (p.status === "archived") return { label: "Archivado", tone: "neutral" };
  if (!p.budgetedHours) return { label: "Sin presupuesto", tone: "neutral" };
  const pct = (p.loggedHours / p.budgetedHours) * 100;
  if (pct > 100) return { label: "Excedido", tone: "danger" };
  if (pct > 85) return { label: "En riesgo", tone: "warning" };
  return { label: "En plazo", tone: "success" };
}

const STATUS = [
  { key: "active", label: "Activos" },
  { key: "archived", label: "Archivados" },
  { key: "all", label: "Todos" },
] as const;

const chip = (active: boolean) =>
  cn(
    "h-8 rounded-lg px-3 text-[13px] font-medium transition-colors",
    active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
  );

/** Tabla de proyectos (estilo Productive / Kantata): buscador, estado y salud de cada uno. */
export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const [status, setStatus] = useState<(typeof STATUS)[number]["key"]>("active");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (!q || `${p.name} ${p.client ?? ""} ${p.department}`.toLowerCase().includes(q)),
    );
  }, [rows, status, query]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Estado">
          {STATUS.map((s) => (
            <button key={s.key} type="button" className={chip(status === s.key)} onClick={() => setStatus(s.key)}>
              {s.label}
              <span className="ml-1.5 text-muted-foreground tabular">
                {s.key === "all" ? rows.length : rows.filter((r) => r.status === s.key).length}
              </span>
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Buscar proyectos</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por proyecto, cliente o área…" className="h-9 pl-9" />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Sin proyectos para mostrar" description="Probá con otro estado u otra búsqueda." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-[13px]">
            <thead>
              <tr className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5 text-left font-medium">Proyecto</th>
                <th className="px-3 py-2.5 text-left font-medium">Área</th>
                <th className="px-3 py-2.5 text-left font-medium">Equipo</th>
                <th className="w-56 px-3 py-2.5 text-left font-medium">Horas</th>
                <th className="px-3 py-2.5 text-right font-medium">Tareas</th>
                <th className="px-3 py-2.5 text-right font-medium">OT abiertas</th>
                <th className="px-3 py-2.5 text-left font-medium">Salud</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const h = health(p);
                const pct = p.budgetedHours ? Math.min(100, (p.loggedHours / p.budgetedHours) * 100) : 0;
                return (
                  <tr key={p.id} className={cn("group relative border-t border-border transition-colors hover:bg-muted/40", p.status === "archived" && "opacity-60")}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/projects/${p.id}`}
                        className="font-medium after:absolute after:inset-0 after:content-[''] group-hover:text-accent"
                      >
                        {p.name}
                      </Link>
                      <p className="text-[12px] text-muted-foreground">
                        {p.client ?? "Interno"}
                        {p.mine > 0 ? <span className="ml-1.5 font-medium text-accent">· {p.mine} tuyas</span> : null}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{p.department}</td>
                    <td className="px-3 py-3">
                      {p.team.length ? (
                        <span className="flex -space-x-1.5" title={p.team.join(", ")}>
                          {p.team.slice(0, 4).map((n) => (
                            <Avatar key={n} name={n} size={24} />
                          ))}
                          {p.team.length > 4 ? (
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10.5px] font-medium ring-2 ring-card">
                              +{p.team.length - 4}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-baseline justify-between text-[12px] tabular">
                        <span className="font-medium">{Math.round(p.loggedHours)}h</span>
                        <span className="text-muted-foreground">{p.budgetedHours ? `de ${p.budgetedHours}h` : "sin presupuesto"}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", h.tone === "danger" ? "bg-danger" : h.tone === "warning" ? "bg-warning" : "bg-accent")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular">
                      {p.tasksDone}/{p.tasksTotal}
                    </td>
                    <td className="px-3 py-3 text-right tabular">{p.openWorkOrders || "—"}</td>
                    <td className="px-3 py-3">
                      <Badge tone={h.tone} dot>
                        {h.label}
                      </Badge>
                    </td>
                    <td className="pr-4 text-right">
                      <ArrowUpRight className="inline size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
