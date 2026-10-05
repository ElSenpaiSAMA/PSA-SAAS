import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar, Reveal, RevealItem } from "@/components/ui/motion";
import { getDepartments, getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProjectMembers, getProjects, getTaskMinutes, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { creatableDepartments } from "@/lib/domain/projects";
import type { Project } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { NewProject } from "./project-form";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage({ params }: PageProps<"/app/[orgId]/projects">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  // RLS ya devuelve solo los proyectos visibles para este usuario
  const [projects, tasks, minutes, departments, members, employees, headed] = await Promise.all([
    getProjects(orgId),
    getTasks(orgId),
    getTaskMinutes(orgId),
    getDepartments(orgId),
    getProjectMembers(orgId),
    getEmployees(orgId),
    getHeadedDepartmentId(orgId, ctx.membership.id),
  ]);

  const managesAll = ctx.can("projects.manage");
  const canCreate = creatableDepartments(
    { managesAllProjects: managesAll, headOfDepartmentId: headed, memberOf: new Set() },
    departments,
  );
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));

  const description = managesAll
    ? "Todos los proyectos de la organización, con sus horas presupuestadas contra las reales."
    : headed
      ? "Los proyectos de tu departamento y aquellos en los que participás."
      : "Los proyectos en los que participás.";

  const groups: { id: string | null; name: string; projects: Project[] }[] = [
    ...departments.map((d) => ({ id: d.id, name: d.name, projects: projects.filter((p) => p.department_id === d.id) })),
    { id: null, name: "Sin departamento", projects: projects.filter((p) => !p.department_id) },
  ].filter((g) => g.projects.length > 0);

  return (
    <>
      <PageHeader title="Proyectos" description={description} />

      {canCreate.length > 0 || managesAll ? (
        <div className="-mt-4 mb-6 flex flex-wrap justify-end gap-2">
          <NewProject orgId={orgId} departments={canCreate.map((d) => ({ id: d.id, name: d.name }))} allowNoDepartment={managesAll} />
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Todavía no participás en ningún proyecto"
          description="Cuando el responsable de tu departamento te sume a uno, lo vas a ver acá."
        />
      ) : (
        <div className="grid gap-10">
          {groups.map((group) => (
            <section key={group.id ?? "none"}>
              <h2 className="mb-3 flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                <Building2 className="size-3.5" strokeWidth={1.75} />
                {group.name}
                <span className="tabular opacity-60">{group.projects.length}</span>
              </h2>
              <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
                {group.projects.map((p) => {
                  const own = tasks.filter((t) => t.project_id === p.id);
                  const logged = own.reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60;
                  const done = own.filter((t) => t.status === "done").length;
                  const mine = own.filter((t) => t.assigned_to === ctx.membership.id && t.status !== "done").length;
                  const team = members.filter((m) => m.project_id === p.id);
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
                          {team.length > 0 ? (
                            <span className="mr-1 flex -space-x-1.5">
                              {team.slice(0, 4).map((m) => (
                                <Avatar key={m.membership_id} name={names.get(m.membership_id) ?? "?"} size={22} />
                              ))}
                            </span>
                          ) : null}
                          <Badge>
                            {done}/{own.length} tareas
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
            </section>
          ))}
        </div>
      )}
    </>
  );
}
