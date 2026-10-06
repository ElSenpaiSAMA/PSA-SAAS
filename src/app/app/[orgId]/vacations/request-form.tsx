"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle, type ActionState } from "@/lib/actions";
import { businessDays } from "@/lib/domain/vacations";
import { cn } from "@/lib/utils";
import { requestVacation } from "./actions";

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RequestForm({ orgId, available, holidays }: { orgId: string; available: number; holidays: string[] }) {
  const [state, action] = useActionState(requestVacation.bind(null, orgId), idle);

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  // Tras un envío exitoso, la key nueva remonta los campos y los deja vacíos
  const resetKey = state.status === "success" ? state.submittedAt : "draft";

  return (
    <form action={action} className="grid gap-4" noValidate>
      <RequestFields key={resetKey} state={state} available={available} holidays={holidays} />
    </form>
  );
}

function RequestFields({ state, available, holidays }: { state: ActionState; available: number; holidays: string[] }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const days = start && end && end >= start ? businessDays({ start_date: start, end_date: end }, new Set(holidays)) : 0;
  const exceeds = days > available;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" error={state.fieldErrors?.startDate}>
          <Input
            name="startDate"
            type="date"
            min={isoToday()}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (!end || end < e.target.value) setEnd(e.target.value);
            }}
          />
        </Field>
        <Field label="Hasta" error={state.fieldErrors?.endDate}>
          <Input name="endDate" type="date" min={start || isoToday()} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>

      <AnimatePresence initial={false}>
        {days > 0 ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "flex items-center justify-between rounded-xl px-4 py-3 text-[13px] transition-colors",
                exceeds ? "bg-danger/10 text-danger" : "bg-accent-soft text-foreground",
              )}
            >
              <span>
                <span className="font-semibold tabular">{days}</span> {days === 1 ? "día hábil" : "días hábiles"}
              </span>
              <span className={exceeds ? "" : "text-muted-foreground"}>
                {exceeds ? "Supera tu saldo" : `Te quedarían ${available - days}`}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Field label="Motivo (opcional)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" maxLength={200} placeholder="Viaje, trámite, descanso…" />
      </Field>

      {state.status === "error" && !state.fieldErrors ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">{state.message}</p>
      ) : null}

      <SubmitButton pendingLabel="Enviando…" disabled={exceeds}>
        Solicitar vacaciones
      </SubmitButton>
    </>
  );
}
