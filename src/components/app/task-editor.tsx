"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTask, updateTask } from "@/app/app/[orgId]/projects/actions";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Spinner, SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";

export interface EditableTask {
  id: string;
  title: string;
  assignedTo: string | null;
  estimatedHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  loggedHours: number;
}

/** Edición en línea de una tarea (dentro de su tarjeta del tablero). */
export function TaskEditor({
  orgId,
  task,
  people,
  onClose,
}: {
  orgId: string;
  task: EditableTask;
  people: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, action] = useActionState(updateTask.bind(null, orgId, task.id), idle);
  const handled = useRef<number | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const hasHours = task.loggedHours > 0;

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") {
      toast.success(state.message);
      onClose();
    } else if (!state.fieldErrors) toast.error(state.message);
  }, [state, onClose]);

  const remove = () =>
    startDelete(async () => {
      const r = await deleteTask(orgId, task.id);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message, { description: task.title });
    });

  return (
    <form action={action} noValidate className="grid gap-2.5">
      <Field label="Título" error={state.fieldErrors?.title}>
        <Input name="title" defaultValue={task.title} className="h-9" autoFocus />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <Field label="Responsable" error={state.fieldErrors?.assignedTo}>
          <Select name="assignedTo" defaultValue={task.assignedTo ?? ""} className="h-9">
            <option value="">Sin asignar</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Horas est." error={state.fieldErrors?.estimatedHours}>
          <Input name="estimatedHours" type="number" min={0} step={0.5} defaultValue={task.estimatedHours ?? ""} className="h-9" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Inicio" error={state.fieldErrors?.startDate}>
          <Input name="startDate" type="date" defaultValue={task.startDate ?? ""} className="h-9 px-2 text-[12px]" />
        </Field>
        <Field label="Vence" error={state.fieldErrors?.dueDate}>
          <Input name="dueDate" type="date" defaultValue={task.dueDate ?? ""} className="h-9 px-2 text-[12px]" />
        </Field>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        {confirming ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-danger px-2.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {deleting ? <Spinner className="size-3" /> : <Trash2 className="size-3.5" />} Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 px-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={hasHours}
            title={hasHours ? "Tiene horas imputadas: no se puede borrar. Marcala como hecha." : "Borrar tarea"}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <Trash2 className="size-3.5" /> Borrar
          </button>
        )}
        <span className="flex items-center gap-1.5">
          <button type="button" onClick={onClose} className="h-8 px-2 text-[12px] text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <SubmitButton size="sm" pendingLabel="Guardando…">
            Guardar
          </SubmitButton>
        </span>
      </div>
      {hasHours ? <p className="text-[11.5px] text-muted-foreground">Tiene horas imputadas: se puede editar, pero no borrar.</p> : null}
    </form>
  );
}
