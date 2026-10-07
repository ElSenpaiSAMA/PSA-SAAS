"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarRange, Lock, Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { LifecycleStepper } from "@/components/app/work-order-lifecycle";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner, SubmitButton } from "@/components/ui/submit-button";
import { idle, type ActionState } from "@/lib/actions";
import {
  nextStep,
  secondarySteps,
  type BillingStatus,
  type LifecycleStep,
  type WorkOrderStatus,
} from "@/lib/domain/work-orders";
import { duplicateWorkOrder, setBillingStatus, setWorkOrderStatus } from "../actions";
import { CopyNextButton } from "../copy-next-button";

/** Estado actual + un único "siguiente paso" + retrocesos discretos. */
export function NextStepPanel({
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
  const [pending, start] = useTransition();
  const can = { manage: canManage, bill: canBill };
  const step = nextStep(status, billing, can);
  const back = secondarySteps(status, billing, can);

  const go = (target: LifecycleStep | "unbilled") =>
    start(async () => {
      const r: ActionState =
        target === "invoiced" || target === "unbilled"
          ? await setBillingStatus(orgId, workOrderId, target)
          : await setWorkOrderStatus(orgId, workOrderId, target);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="Estado de la orden de trabajo">
      <LifecycleStepper status={status} billing={billing} />

      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            {step ? <ArrowRight className="size-4" strokeWidth={1.75} /> : <Lock className="size-4" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium">{step ? `Siguiente paso: ${step.label}` : "Ciclo completo"}</p>
            <p className="text-[12.5px] text-muted-foreground">
              {step
                ? step.allowed
                  ? step.description
                  : step.target === "invoiced"
                    ? step.description
                    : "Lo da quien gestiona el proyecto (responsable del departamento o administración)."
                : "OT facturada: queda bloqueada para cambios y para imputar horas."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {back.map((b) => (
            <Button key={b.target} variant="ghost" size="sm" disabled={pending} onClick={() => go(b.target)}>
              {b.label}
            </Button>
          ))}
          {step?.allowed ? (
            <Button variant={step.target === "invoiced" ? "accent" : "primary"} disabled={pending} onClick={() => go(step.target)}>
              {pending ? <Spinner /> : null}
              {step.label}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Bloque plegable con título; se usa para "Agregar tarea" y "Repetir esta OT". */
export function Collapsible({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: "plus" | "repeat";
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = icon === "plus" ? Plus : CalendarRange;
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left text-[13.5px] font-medium"
      >
        <Icon className={`size-4 text-muted-foreground transition-transform ${open && icon === "plus" ? "rotate-45" : ""}`} strokeWidth={1.75} />
        {title}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 py-4">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** "Repetir esta OT": copia rápida al mes siguiente o a un período a medida. */
export function RepeatWorkOrder({
  orgId,
  workOrderId,
  nextLabel,
  continuationHref,
  defaultTitle,
  defaultStart,
  defaultEnd,
}: {
  orgId: string;
  workOrderId: string;
  nextLabel: string;
  /** Si la OT del período siguiente ya existe, se enlaza en lugar de copiar */
  continuationHref?: string;
  defaultTitle: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [custom, setCustom] = useState(false);
  const [state, action] = useActionState(duplicateWorkOrder.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <div className="grid gap-3">
      <p className="text-[12.5px] text-muted-foreground">
        Crea una OT nueva con las mismas tareas (en «Por hacer», sin horas) y las fechas corridas al nuevo período. Esta OT no cambia.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {continuationHref ? (
          <Link href={continuationHref} className={buttonClasses("secondary")}>
            Ver la OT de {nextLabel} <ArrowRight className="size-4" />
          </Link>
        ) : (
          <CopyNextButton orgId={orgId} workOrderId={workOrderId} targetLabel={nextLabel} variant="full" />
        )}
        <button
          type="button"
          onClick={() => setCustom((c) => !c)}
          className="h-10 px-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {custom ? "Cancelar" : "Otro período…"}
        </button>
      </div>
      <AnimatePresence>
        {custom ? (
          <motion.form
            action={action}
            noValidate
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
              <Field label="Título" error={state.fieldErrors?.title}>
                <Input name="title" defaultValue={defaultTitle} />
              </Field>
              <Field label="Desde" error={state.fieldErrors?.periodStart}>
                <Input name="periodStart" type="date" defaultValue={defaultStart} />
              </Field>
              <Field label="Hasta" error={state.fieldErrors?.periodEnd}>
                <Input name="periodEnd" type="date" defaultValue={defaultEnd} />
              </Field>
              <SubmitButton pendingLabel="Creando…">Crear copia</SubmitButton>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tarjeta de tareas de la OT: una barra de herramientas compacta (título + acciones)
 * sobre el tablero. "Agregar tarea" y "Repetir" despliegan su formulario debajo.
 */
export function TasksPanel({
  count,
  addForm,
  repeatForm,
  defaultOpen,
  children,
}: {
  count: number;
  addForm?: ReactNode;
  repeatForm?: ReactNode;
  defaultOpen?: "add" | "repeat";
  children: ReactNode;
}) {
  const [open, setOpen] = useState<"add" | "repeat" | null>(defaultOpen ?? null);
  const toggle = (panel: "add" | "repeat") => setOpen((o) => (o === panel ? null : panel));
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="tasks-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="tasks-title" className="text-[15px] font-semibold tracking-tight">
          Tareas <span className="ml-1 text-muted-foreground tabular">{count}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {repeatForm ? (
            <button
              type="button"
              aria-expanded={open === "repeat"}
              aria-label="Repetir esta OT en otro período"
              onClick={() => toggle("repeat")}
              className={buttonClasses(open === "repeat" ? "secondary" : "ghost", "sm")}
            >
              <CalendarRange className="size-4" strokeWidth={1.75} /> Repetir OT
            </button>
          ) : null}
          {addForm ? (
            <button
              type="button"
              aria-expanded={open === "add"}
              onClick={() => toggle("add")}
              className={buttonClasses(open === "add" ? "secondary" : "primary", "sm")}
            >
              <Plus className={`size-4 transition-transform ${open === "add" ? "rotate-45" : ""}`} strokeWidth={2} /> Agregar tarea
            </button>
          ) : null}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key={open}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-b border-border bg-muted/30 px-5 py-4">{open === "add" ? addForm : repeatForm}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="p-4">{children}</div>
    </section>
  );
}
