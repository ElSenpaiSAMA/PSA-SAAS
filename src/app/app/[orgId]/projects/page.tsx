import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar, Reveal, RevealItem } from "@/components/ui/motion";
import { getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { cn } from "@/lib/utils";
import { NewProject } from "./project-form";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage({ params }: PageProps<"/app/[orgId]/projects">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const [projects, tasks, minutes] = await Promise.all([getProjects(orgId), getTasks(orgId), getTaskMinutes(orgId)]);

  const stats = projects.map((p) => {
    const own = tasks.filter((t) => t.project_id === p.id);
    const logged = own.reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60;
    const done = own.filter((t) => t.status === "done").length;
    const mine = own.filter((t) => t.assigned_to === ctx.membership.id && t.status !== "done").length;
    return { project: p, total: own.length, done, logged, mine };
  });

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Horas presupuestadas contra horas reales, tarea por tarea."
      />

      {ctx.can("projects.manage") ? (
        <div className="-mt-4 mb-6 flex flex-wrap justify-end gap-2">
          <NewProject orgId={orgId} />
        </div>
      ) : null}

      {stats.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Todavía no hay proyectos"
          description={ctx.can("projects.manage") ? "Creá el primero para empezar a imputar horas." : "Cuando un admin cree uno, lo vas a ver acá."}
        />
      ) : (
        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
          {stats.map(({ project: p, total, done, logged, mine }) => {
            const pct = p.budgeted_hours ? (logged / p.budgeted_hours) * 100 : 0;
            const tone = pct > 100 ? "danger" : pct > 85 ? "warning" : "accent";
            return (
              <RevealItem key={p.id}>
                <Link
                  href={`/app/${orgId}/projects/${p.id}`}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_16px_40px_-20px_rgb(0_0_0/0.3)]",
                    p.status === "archived" && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-tight">{p.name}</p>
                      <p className="truncate text-[13px] text-muted-foreground">{p.client_name ?? "Interno"}</p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
                      <span className="text-muted-foreground">Horas</span>
                      <span className="tabular">
                        <span className="font-medium">{Math.round(logged)}</span>
                        <span className="text-muted-foreground">{p.budgeted_hours ? ` / ${p.budgeted_hours}h` : "h"}</span>
                      </span>
                    </div>
                    <ProgressBar value={p.budgeted_hours ? logged : 0} max={p.budgeted_hours ?? 1} tone={tone} />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Badge>
                      {done}/{total} tareas
                    </Badge>
                    {mine > 0 ? <Badge tone="accent">{mine} tuyas</Badge> : null}
                    {p.status === "archived" ? <Badge>Archivado</Badge> : null}
                    {pct > 100 ? <Badge tone="danger">Excedido</Badge> : null}
                  </div>
                </Link>
              </RevealItem>
            );
          })}
        </Reveal>
      )}
    </>
  );
}
