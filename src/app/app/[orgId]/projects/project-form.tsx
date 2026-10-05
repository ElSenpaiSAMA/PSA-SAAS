"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { createProject } from "./actions";

export function NewProject({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createProject.bind(null, orgId), idle);
  const [handled, setHandled] = useState<number | undefined>();

  // Cerrar el panel tras crear (derivado del estado de la acción, sin efectos que sincronicen estado)
  if (state.status === "success" && state.submittedAt !== handled) {
    setHandled(state.submittedAt);
    setOpen(false);
  }

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen((o) => !o)} variant={open ? "secondary" : "primary"}>
        <Plus className={`size-4 transition-transform duration-300 ${open ? "rotate-45" : ""}`} />
        {open ? "Cerrar" : "Nuevo proyecto"}
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
            className="col-span-full basis-full overflow-hidden"
          >
            <div className="mt-2 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
              <Field label="Nombre" error={state.fieldErrors?.name}>
                <Input name="name" placeholder="Rediseño portal clientes" autoFocus />
              </Field>
              <Field label="Cliente" error={state.fieldErrors?.clientName}>
                <Input name="clientName" placeholder="Opcional" />
              </Field>
              <Field label="Presupuesto (h)" error={state.fieldErrors?.budgetedHours}>
                <Input name="budgetedHours" type="number" min="0" placeholder="120" />
              </Field>
              <SubmitButton pendingLabel="Creando…">Crear</SubmitButton>
            </div>
            {state.status === "error" && !state.fieldErrors ? (
              <p className="mt-2 text-[13px] text-danger">{state.message}</p>
            ) : null}
          </motion.form>
        ) : null}
      </AnimatePresence>
    </>
  );
}
