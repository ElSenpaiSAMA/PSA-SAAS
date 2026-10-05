"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { formatMonth } from "@/lib/domain/periods";
import { createWorkOrder } from "./actions";

export interface ProjectOption {
  id: string;
  name: string;
  hourlyRate: number | null;
}

export function NewWorkOrder({
  orgId,
  projects,
  periodStart,
  periodEnd,
  defaultProjectId,
  label = "Nueva OT",
}: {
  orgId: string;
  projects: ProjectOption[];
  periodStart: string;
  periodEnd: string;
  defaultProjectId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createWorkOrder.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  if (projects.length === 0) return null;

  return (
    <>
      <Button onClick={() => setOpen((o) => !o)} variant={open ? "secondary" : "primary"}>
        <Plus className={`size-4 transition-transform duration-300 ${open ? "rotate-45" : ""}`} />
        {open ? "Cerrar" : label}
      </Button>
      <AnimatePresence>
        {open ? (
          <motion.form
            action={action}
            noValidate
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="basis-full overflow-hidden"
          >
            <div className="mt-2 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
              {defaultProjectId ? (
                <input type="hidden" name="projectId" value={projectId} />
              ) : (
                <Field label="Proyecto" error={state.fieldErrors?.projectId}>
                  <Select name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Título" error={state.fieldErrors?.title} className={defaultProjectId ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-2"}>
                <Input
                  key={projectId}
                  name="title"
                  defaultValue={project ? `${project.name} · ${formatMonth(periodStart)}` : ""}
                />
              </Field>
              <Field label="Desde" error={state.fieldErrors?.periodStart}>
                <Input name="periodStart" type="date" defaultValue={periodStart} />
              </Field>
              <Field label="Hasta" error={state.fieldErrors?.periodEnd}>
                <Input name="periodEnd" type="date" defaultValue={periodEnd} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Horas" error={state.fieldErrors?.budgetedHours}>
                  <Input name="budgetedHours" type="number" min="0" placeholder="80" />
                </Field>
                <Field label="Tarifa €/h" error={state.fieldErrors?.hourlyRate} hint={project?.hourlyRate ? `Proyecto: ${project.hourlyRate}` : undefined}>
                  <Input key={projectId} name="hourlyRate" type="number" min="0" step="0.5" placeholder={project?.hourlyRate?.toString() ?? "—"} />
                </Field>
              </div>
              <div className="flex items-end justify-end sm:col-span-2 lg:col-span-3">
                <SubmitButton pendingLabel="Creando…">Crear orden de trabajo</SubmitButton>
              </div>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </>
  );
}
