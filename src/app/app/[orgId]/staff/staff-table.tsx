"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface StaffRow {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
  position: string | null;
  roleLabel: string;
  departmentId: string | null;
  departmentName: string | null;
  managerName: string | null;
  reports: number;
  status: "active" | "inactive";
  /** Solo si quien mira tiene acceso a la ficha */
  hireDate: string | null;
  isMe: boolean;
  /** Puede abrir su perfil: el propio, o alguien a quien supervisa (si no, es solo directorio) */
  canOpen: boolean;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export function StaffTable({
  orgId,
  rows,
  departments,
  showHireDate,
}: {
  orgId: string;
  rows: StaffRow[];
  departments: { id: string; name: string }[];
  showHireDate: boolean;
}) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (showInactive || r.status === "active") &&
        (department === "all" || (department === "none" ? !r.departmentId : r.departmentId === department)) &&
        (!q || [r.name, r.email, r.position, r.departmentName].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [rows, query, department, showInactive]);

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] transition-colors",
      active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email, puesto…"
            aria-label="Buscar empleados"
            className="h-10 w-full rounded-xl border border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-border-strong"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por departamento">
          <button type="button" className={chip(department === "all")} onClick={() => setDepartment("all")}>
            Todos
          </button>
          {departments.map((d) => (
            <button key={d.id} type="button" className={chip(department === d.id)} onClick={() => setDepartment(d.id)}>
              {d.name}
            </button>
          ))}
          {rows.some((r) => !r.departmentId) ? (
            <button type="button" className={chip(department === "none")} onClick={() => setDepartment("none")}>
              Sin departamento
            </button>
          ) : null}
        </div>
        {rows.some((r) => r.status === "inactive") ? (
          <label className="ml-auto inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar bajas
          </label>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nadie coincide con la búsqueda"
          description="Probá con otro nombre o quitá el filtro de departamento."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="border-b border-border text-[12px] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-3 py-3 font-medium">Puesto</th>
                <th className="px-3 py-3 font-medium">Departamento</th>
                <th className="px-3 py-3 font-medium">Responsable</th>
                {showHireDate ? <th className="px-3 py-3 font-medium">Alta</th> : null}
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={cn("group relative border-b border-border transition-colors last:border-b-0", r.canOpen && "hover:bg-muted/40")}
                >
                  <td className="px-5 py-3">
                    {r.canOpen ? (
                      <Link
                        href={`/app/${orgId}/staff/${r.id}`}
                        className="flex items-center gap-3 after:absolute after:inset-0 after:content-['']"
                        aria-label={`Ver perfil de ${r.name}`}
                      >
                        <PersonCell r={r} />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3">
                        <PersonCell r={r} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="block">{r.position ?? "—"}</span>
                    <span className="text-[12px] text-muted-foreground">{r.roleLabel}</span>
                  </td>
                  <td className="px-3 py-3">{r.departmentName ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">
                    <span className="block">{r.managerName ?? <span className="text-muted-foreground">—</span>}</span>
                    {r.reports ? (
                      <span className="text-[12px] text-muted-foreground">
                        {r.reports} {r.reports === 1 ? "persona a cargo" : "personas a cargo"}
                      </span>
                    ) : null}
                  </td>
                  {showHireDate ? (
                    <td className="px-3 py-3 tabular text-muted-foreground">{r.hireDate ? fmtDate(r.hireDate) : "—"}</td>
                  ) : null}
                  <td className="px-3 py-3 text-muted-foreground">
                    {r.canOpen ? <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] text-muted-foreground">
        {visible.length} de {rows.filter((r) => showInactive || r.status === "active").length} personas
      </p>
    </div>
  );
}

function PersonCell({ r }: { r: StaffRow }) {
  return (
    <>
      <Avatar name={r.name} src={r.avatar} size={34} />
      <span className="min-w-0">
        <span className={cn("flex items-center gap-2 font-medium", r.canOpen && "group-hover:text-accent")}>
          {r.name}
          {r.isMe ? <span className="text-[12px] font-normal text-muted-foreground">(vos)</span> : null}
          {r.status === "inactive" ? <Badge tone="neutral">Baja</Badge> : null}
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">{r.email}</span>
      </span>
    </>
  );
}
