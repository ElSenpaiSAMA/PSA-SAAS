"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { logTaskHours } from "./actions";

export interface TaskOption {
  id: string;
  title: string;
  projectName: string;
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LogHoursForm({ orgId, tasks }: { orgId: string; tasks: TaskOption[] }) {
  const [state, action] = useActionState(logTaskHours.bind(null, orgId), idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.submittedAt) return;
    if (state.status === "success") {
      toast.success(state.message);
      const hours = formRef.current?.elements.namedItem("hours") as HTMLInputElement | null;
      if (hours) hours.value = "";
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
        No tenés tareas abiertas en órdenes de trabajo activas. Cuando te asignen una, vas a poder imputarle horas desde acá.
      </p>
    );
  }

  const byProject = new Map<string, TaskOption[]>();
  for (const t of tasks) byProject.set(t.projectName, [...(byProject.get(t.projectName) ?? []), t]);

  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <Field label="Tarea" error={state.fieldErrors?.taskId}>
        <Select name="taskId" defaultValue={tasks[0]?.id}>
          {[...byProject.entries()].map(([project, items]) => (
            <optgroup key={project} label={project}>
              {items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" error={state.fieldErrors?.date}>
          <Input name="date" type="date" defaultValue={todayLocal()} max={todayLocal()} />
        </Field>
        <Field label="Horas" error={state.fieldErrors?.hours} hint="Ej: 1.5">
          <Input name="hours" type="number" inputMode="decimal" step="0.25" min="0.25" max="12" placeholder="2" />
        </Field>
      </div>
      <SubmitButton pendingLabel="Guardando…">Registrar horas</SubmitButton>
    </form>
  );
}
