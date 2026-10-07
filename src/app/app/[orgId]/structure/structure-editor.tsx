"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { FUNCTION_PERMISSIONS } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";
import { createBranch, setUnitPermission } from "./actions";

export interface Unit {
  kind: "branch" | "department";
  id: string;
  name: string;
  color: string | null;
  /** Director(es) de la rama o responsable del departamento */
  who: string;
  /** Departamentos de la rama, o rama del departamento */
  detail: string;
  permissions: string[];
}

const DOT: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  teal: "bg-teal-500",
};

const COLORS = [
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "violet", label: "Violeta" },
  { value: "amber", label: "Ámbar" },
  { value: "rose", label: "Rosa" },
  { value: "teal", label: "Turquesa" },
];

export function StructureEditor({ orgId, branches, departments }: { orgId: string; branches: Unit[]; departments: Unit[] }) {
  return (
    <div className="grid gap-8">
      <section aria-labelledby="ramas">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="ramas" className="text-[16px] font-semibold tracking-tight">
              Ramas
            </h2>
            <p className="text-[13px] text-muted-foreground">Lo que marques lo recibe quien dirige la rama.</p>
          </div>
        </div>
        <PermissionMatrix orgId={orgId} units={branches} whoLabel="Dirige" />
        <NewBranch orgId={orgId} />
      </section>

      <section aria-labelledby="departamentos">
        <div className="mb-3">
          <h2 id="departamentos" className="text-[16px] font-semibold tracking-tight">
            Departamentos
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Lo que marques lo recibe el responsable del departamento (por ejemplo, RRHH gestiona personas).
          </p>
        </div>
        <PermissionMatrix orgId={orgId} units={departments} whoLabel="Responsable" />
      </section>
    </div>
  );
}

function PermissionMatrix({ orgId, units, whoLabel }: { orgId: string; units: Unit[]; whoLabel: string }) {
  if (units.length === 0) return <p className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">Todavía no hay.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[56rem] text-left text-[13px]">
        <thead className="border-b border-border text-[11.5px] text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 bg-card px-4 py-3 font-medium">Unidad</th>
            {FUNCTION_PERMISSIONS.map((p) => (
              <th key={p.key} className="px-2 py-3 text-center font-medium" title={p.hint}>
                <span className="inline-block max-w-[6.5rem] leading-tight">{p.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-b-0">
              <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-normal">
                <span className="flex items-center gap-2 font-medium">
                  {u.color ? <span className={cn("size-2.5 rounded-full", DOT[u.color] ?? "bg-muted-foreground")} aria-hidden /> : null}
                  {u.name}
                </span>
                <span className="block text-[12px] text-muted-foreground">
                  {whoLabel}: {u.who || "nadie"}
                  {u.detail ? ` · ${u.detail}` : ""}
                </span>
              </th>
              {FUNCTION_PERMISSIONS.map((p) => (
                <td key={p.key} className="px-2 py-3 text-center">
                  <PermissionToggle orgId={orgId} unit={u} permission={p.key} label={`${p.label} para ${u.name}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionToggle({ orgId, unit, permission, label }: { orgId: string; unit: Unit; permission: string; label: string }) {
  const [checked, setChecked] = useState(unit.permissions.includes(permission));
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        setChecked(next);
        start(async () => {
          const r = await setUnitPermission(orgId, unit.kind, unit.id, permission, next);
          if (r.status === "error") {
            setChecked(!next);
            toast.error(r.message);
          }
        });
      }}
      className="size-4 cursor-pointer accent-[var(--color-accent)] disabled:opacity-50"
    />
  );
}

function NewBranch({ orgId }: { orgId: string }) {
  const [state, action] = useActionState(createBranch.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") toast.success(state.message);
    else if (!state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <form
      key={state.status === "success" ? state.submittedAt : "draft"}
      action={action}
      className="mt-3 grid gap-3 rounded-2xl border border-dashed border-border-strong p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
    >
      <Field label="Nueva rama" error={state.fieldErrors?.name}>
        <Input name="name" placeholder="Ej: Logística" />
      </Field>
      <Field label="Color">
        <Select name="color" defaultValue="amber">
          {COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton pendingLabel="Creando…">
        <Plus className="size-4" /> Crear rama
      </SubmitButton>
    </form>
  );
}
