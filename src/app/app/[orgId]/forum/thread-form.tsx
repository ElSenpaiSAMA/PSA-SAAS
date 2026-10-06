"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle, type ActionState } from "@/lib/actions";
import { FORUM_CATEGORIES } from "@/lib/domain/forum";
import type { ForumCategory } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** Alta y edición de un hilo. La acción ya viene ligada a la org (y al hilo si se edita). */
export function ThreadForm({
  action,
  initial,
  submitLabel,
  onDone,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: { category: ForumCategory; title: string; body: string };
  submitLabel: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, idle);

  useEffect(() => {
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-[13px] font-medium text-foreground/80">Categoría</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {FORUM_CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-xl border border-border bg-card p-3.5 transition-colors",
                "hover:border-border-strong has-[:checked]:border-foreground has-[:checked]:bg-muted/60",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40",
              )}
            >
              <span className="flex items-center gap-2 text-[14px] font-medium">
                <input
                  type="radio"
                  name="category"
                  value={c.value}
                  defaultChecked={(initial?.category ?? "question") === c.value}
                  className="accent-foreground"
                />
                {c.label}
              </span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">{c.hint}</span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.category ? <p className="text-[12.5px] text-danger">{state.fieldErrors.category[0]}</p> : null}
      </fieldset>

      <Field label="Título" error={state.fieldErrors?.title}>
        <Input name="title" defaultValue={initial?.title} placeholder="Ej.: Fallo intermitente en el plotter del Lagoon 42" maxLength={140} />
      </Field>
      <Field label="Mensaje" error={state.fieldErrors?.body} hint="Contá el contexto: barco, equipo, qué probaste.">
        <Textarea name="body" defaultValue={initial?.body} rows={8} maxLength={5000} />
      </Field>

      {state.status === "error" && !state.fieldErrors ? <p className="text-[13px] text-danger">{state.message}</p> : null}
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
