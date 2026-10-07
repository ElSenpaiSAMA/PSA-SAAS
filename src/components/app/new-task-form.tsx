"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTask } from "@/app/app/[orgId]/projects/actions";
import { idle } from "@/lib/actions";

export function NewTaskForm({
  orgId,
  projectId,
  workOrderId,
  periodStart,
  periodEnd,
  people,
}: {
  orgId: string;
  projectId: string;
  workOrderId: string;
  periodStart: string;
  periodEnd: string;
  people: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(createTask.bind(null, orgId), idle);
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
      noValidate
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr_0.7fr_auto] lg:items-end"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <Field label="Nueva tarea" error={state.fieldErrors?.title}>
        <Input name="title" placeholder="Ej: Revisión del generador" />
      </Field>
      <Field label="Asignar a" error={state.fieldErrors?.assignedTo}>
        <Select name="assignedTo" defaultValue="">
          <option value="">Sin asignar</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Inicio" error={state.fieldErrors?.startDate}>
        <Input name="startDate" type="date" defaultValue={periodStart} min={periodStart} max={periodEnd} />
      </Field>
      <Field label="Vence" error={state.fieldErrors?.dueDate}>
        <Input name="dueDate" type="date" defaultValue={periodEnd} min={periodStart} max={periodEnd} />
      </Field>
      <Field label="Horas" error={state.fieldErrors?.estimatedHours}>
        <Input name="estimatedHours" type="number" min="0" step="0.5" placeholder="8" />
      </Field>
      <SubmitButton pendingLabel="Creando…">Agregar</SubmitButton>
    </form>
  );
}
