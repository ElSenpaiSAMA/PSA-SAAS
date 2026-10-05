"use client";

import { AnimatePresence, motion } from "motion/react";
import { Copy, Receipt, Undo2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner, SubmitButton } from "@/components/ui/submit-button";
import { idle, type ActionState } from "@/lib/actions";
import {
  canInvoice,
  nextStatuses,
  TRANSITION_LABEL,
  type BillingStatus,
  type WorkOrderStatus,
} from "@/lib/domain/work-orders";
import { duplicateWorkOrder, setBillingStatus, setWorkOrderStatus } from "../actions";
import { CopyNextButton } from "../copy-next-button";

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });
  return [pending, run] as const;
}

export function WorkOrderControls({
  orgId,
  workOrderId,
  status,
  billing,
  canManage,
  canBill,
}: {
  orgId: string;
  workOrderId: string;
  status: WorkOrderStatus;
  billing: BillingStatus;
  canManage: boolean;
  canBill: boolean;
}) {
  const [pending, run] = useRun();
  const transitions = canManage ? nextStatuses(status, billing) : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions.map((next) => (
        <Button
          key={next}
          variant={next === "approved" || next === "closed" ? "primary" : "secondary"}
          disabled={pending}
          onClick={() => run(() => setWorkOrderStatus(orgId, workOrderId, next))}
        >
          {pending ? <Spinner /> : null}
          {TRANSITION_LABEL[next]}
        </Button>
      ))}
      {canBill && canInvoice(status, billing) ? (
        <Button variant="accent" disabled={pending} onClick={() => run(() => setBillingStatus(orgId, workOrderId, "invoiced"))}>
          <Receipt className="size-4" /> Marcar facturada
        </Button>
      ) : null}
      {canBill && billing === "invoiced" ? (
        <Button variant="ghost" disabled={pending} onClick={() => run(() => setBillingStatus(orgId, workOrderId, "unbilled"))}>
          <Undo2 className="size-4" /> Revertir facturación
        </Button>
      ) : null}
      {canManage ? <CopyNextButton orgId={orgId} workOrderId={workOrderId} variant="full" /> : null}
    </div>
  );
}

export function DuplicateWorkOrder({
  orgId,
  workOrderId,
  defaultTitle,
  defaultStart,
  defaultEnd,
}: {
  orgId: string;
  workOrderId: string;
  defaultTitle: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(duplicateWorkOrder.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Copy className="size-3.5" /> {open ? "Cancelar duplicado" : "Duplicar a otro período…"}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.form
            action={action}
            noValidate
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
              <Field label="Título" error={state.fieldErrors?.title}>
                <Input name="title" defaultValue={defaultTitle} />
              </Field>
              <Field label="Desde" error={state.fieldErrors?.periodStart}>
                <Input name="periodStart" type="date" defaultValue={defaultStart} />
              </Field>
              <Field label="Hasta" error={state.fieldErrors?.periodEnd}>
                <Input name="periodEnd" type="date" defaultValue={defaultEnd} />
              </Field>
              <SubmitButton pendingLabel="Duplicando…">Duplicar</SubmitButton>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Se copian todas las tareas (reiniciadas a &quot;Por hacer&quot;) y sus fechas se corren al nuevo período.
            </p>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
