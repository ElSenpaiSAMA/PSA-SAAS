import type { Metadata } from "next";
import Link from "next/link";
import { Bug, CircleCheck, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { getErrorCounts, getErrorLogs, isErrorFilter, type ErrorFilter } from "@/lib/data/errors";
import { requirePermission } from "@/lib/data/session";
import { cn } from "@/lib/utils";
import { ErrorList } from "./error-list";

export const metadata: Metadata = { title: "Errores" };

const FILTERS: { key: ErrorFilter; label: string }[] = [
  { key: "open", label: "Sin resolver" },
  { key: "resolved", label: "Resueltos" },
  { key: "all", label: "Todos" },
];

export default async function ErrorsPage({ params, searchParams }: PageProps<"/app/[orgId]/errors">) {
  const { orgId } = await params;
  const { estado } = await searchParams;
  await requirePermission(orgId, "platform.manage");
  const filter: ErrorFilter = isErrorFilter(estado) ? estado : "open";
  const [logs, counts] = await Promise.all([getErrorLogs(filter), getErrorCounts()]);

  return (
    <>
      <PageHeader
        title="Registro"
        accent="de errores"
        description="Lo que falló en la app: en el servidor, en una acción o en el navegador de alguien. Se registra solo; acá se revisa y se marca como resuelto."
      />

      <div className="mb-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <StatCard index={0} label="Sin resolver" value={counts.open} icon={Bug} />
        <StatCard index={1} label="Últimas 24 horas" value={counts.last24h} icon={Clock3} />
        <StatCard index={2} label="En esta vista" value={logs.length} icon={CircleCheck} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <nav aria-label="Filtrar por estado" className="flex gap-1 border-b border-border p-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/app/errors?estado=${f.key}`}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors",
                f.key === filter ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <ErrorList
          orgId={orgId}
          items={logs.map((l) => ({
            id: l.id,
            createdAt: l.created_at,
            source: l.source,
            message: l.message,
            digest: l.digest,
            stack: l.stack,
            path: l.path,
            context: l.context,
            resolved: l.resolved_at !== null,
          }))}
          emptyText={filter === "open" ? "No hay errores sin resolver." : "No hay errores en esta vista."}
        />
      </div>
    </>
  );
}
