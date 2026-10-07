"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building2, FolderKanban, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { deleteDepartment, saveDepartment } from "./actions";
import type { Person } from "./team-view";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface DepartmentInfo {
  id: string;
  name: string;
  headId: string | null;
  projectCount: number;
}

function DepartmentForm({
  orgId,
  department,
  people,
  takenHeads,
  onDone,
}: {
  orgId: string;
  department?: DepartmentInfo;
  people: Person[];
  takenHeads: Set<string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveDepartment.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onDone]);

  // Una persona encabeza como mucho un departamento
  const candidates = people.filter((p) => !takenHeads.has(p.id) || p.id === department?.headId);

  return (
    <motion.form
      action={action}
      noValidate
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="overflow-hidden"
    >
      {department ? <input type="hidden" name="departmentId" value={department.id} /> : null}
      <div className="grid gap-3 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Nombre" error={state.fieldErrors?.name}>
          <Input name="name" defaultValue={department?.name} placeholder="Ej: Ingeniería" autoFocus={!department} />
        </Field>
        <Field label="Responsable" error={state.fieldErrors?.headId}>
          <Select name="headId" defaultValue={department?.headId ?? ""}>
            <option value="">Sin responsable</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pendingLabel="Guardando…">{department ? "Guardar" : "Crear"}</SubmitButton>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        El responsable pasa a ser el manager de las personas del departamento: aprueba sus vacaciones, ve sus horas y gestiona
        los proyectos del departamento.
      </p>
    </motion.form>
  );
}

function DeleteDepartment({ orgId, id, name }: { orgId: string; id: string; name: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Eliminar ${name}`}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteDepartment(orgId, id);
            if (r.status === "error") toast.error(r.message);
            else toast.success(r.message);
          })
        }
        className="h-8 rounded-lg bg-danger/10 px-2.5 text-[12.5px] font-medium text-danger hover:bg-danger/15 disabled:opacity-50"
      >
        {pending ? "Eliminando…" : "Eliminar"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        aria-label="Cancelar"
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function DepartmentsView({
  orgId,
  departments,
  people,
  canManage,
}: {
  orgId: string;
  departments: DepartmentInfo[];
  people: Person[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const takenHeads = new Set(departments.map((d) => d.headId).filter((h): h is string => !!h));
  const byId = new Map(people.map((p) => [p.id, p]));
  const unassigned = people.filter((p) => !p.departmentId);

  return (
    <div className="grid gap-4">
      {canManage ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Departamentos</p>
              <p className="text-[13px] text-muted-foreground">Dividí la organización y asigná un responsable a cada área.</p>
            </div>
            <Button variant={editing === "new" ? "secondary" : "primary"} onClick={() => setEditing(editing === "new" ? null : "new")}>
              <Plus className={cn("size-4 transition-transform duration-300", editing === "new" && "rotate-45")} />
              {editing === "new" ? "Cerrar" : "Nuevo departamento"}
            </Button>
          </div>
          <AnimatePresence>
            {editing === "new" ? (
              <DepartmentForm orgId={orgId} people={people} takenHeads={takenHeads} onDone={() => setEditing(null)} />
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      {departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Todavía no hay departamentos"
          description={canManage ? "Creá el primero para organizar a las personas y sus proyectos." : "Un administrador puede crearlos."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {departments.map((d, i) => {
            const head = d.headId ? byId.get(d.headId) : undefined;
            const members = people.filter((p) => p.departmentId === d.id);
            const open = editing === d.id;
            return (
              <motion.article
                key={d.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.6, ease: EASE }}
                className={cn("rounded-2xl border bg-card p-5", open ? "border-accent/40 md:col-span-2" : "border-border")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-gradient-to-b from-card to-muted">
                      <Building2 className="size-[18px]" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-tight">{d.name}</h3>
                      <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                        {members.length} {members.length === 1 ? "persona" : "personas"}
                        <span aria-hidden>·</span>
                        <FolderKanban className="size-3" strokeWidth={1.75} /> {d.projectCount}{" "}
                        {d.projectCount === 1 ? "proyecto" : "proyectos"}
                      </p>
                    </div>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(open ? null : d.id)}
                        aria-label={open ? "Cerrar edición" : `Editar ${d.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {open ? <X className="size-4" /> : <Pencil className="size-4" strokeWidth={1.75} />}
                      </button>
                      <DeleteDepartment orgId={orgId} id={d.id} name={d.name} />
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                  {head ? (
                    <>
                      <Avatar name={head.name} size={30} className="ring-0" />
                      <div className="min-w-0">
                        <p className="text-[11.5px] text-muted-foreground">Responsable</p>
                        <p className="truncate text-[13.5px] font-medium">{head.name}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">Sin responsable asignado</p>
                  )}
                </div>

                {members.length > 0 ? (
                  <div className="mt-4 flex -space-x-2">
                    {members.slice(0, 8).map((m) => (
                      <span key={m.id} title={m.name}>
                        <Avatar name={m.name} size={28} />
                      </span>
                    ))}
                    {members.length > 8 ? (
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] ring-2 ring-background">
                        +{members.length - 8}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <AnimatePresence>
                  {open ? (
                    <DepartmentForm
                      orgId={orgId}
                      department={d}
                      people={people}
                      takenHeads={takenHeads}
                      onDone={() => setEditing(null)}
                    />
                  ) : null}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      )}

      {departments.length > 0 && unassigned.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {unassigned.length} {unassigned.length === 1 ? "persona no tiene" : "personas no tienen"} departamento:{" "}
          {unassigned.map((p) => p.name).join(", ")}. Asignalos desde el Directorio.
        </p>
      ) : null}
    </div>
  );
}
