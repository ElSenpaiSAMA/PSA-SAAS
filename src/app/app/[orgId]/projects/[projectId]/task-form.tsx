"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { createTask } from "../actions";

export function NewTaskForm({
  orgId,
  projectId,
  people,
}: {
  orgId: string;
  projectId: string;
  people: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(createTask.bind(null, orgId), idle);

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
    if (state.status === "error" && !state.fieldErrors && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form
      key={state.status === "success" ? state.submittedAt : "draft"}
      action={action}
      noValidate
      className="grid gap-3 sm:grid-cols-[2fr_1.4fr_0.8fr_auto] sm:items-end"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <Field label="Nueva tarea" error={state.fieldErrors?.title}>
        <Input name="title" placeholder="Ej: Diseñar onboarding" />
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
      <Field label="Estimación (h)" error={state.fieldErrors?.estimatedHours}>
        <Input name="estimatedHours" type="number" min="0" step="0.5" placeholder="8" />
      </Field>
      <SubmitButton pendingLabel="Creando…">Agregar</SubmitButton>
    </form>
  );
}
