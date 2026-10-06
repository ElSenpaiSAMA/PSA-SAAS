"use client";

import { motion } from "motion/react";
import { CalendarClock, Play, Zap } from "lucide-react";
import { useActionState, useEffect, useOptimistic, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner, SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { fillText, type AutomationMeta } from "@/lib/domain/automations";
import { cn } from "@/lib/utils";
import { runAutomationNow, saveAutomationParams, setAutomationEnabled } from "./actions";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        checked ? "bg-accent" : "bg-border-strong",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 35 }}
        className={cn("inline-block size-5 rounded-full bg-white shadow", checked ? "ml-[22px]" : "ml-0.5")}
      />
    </button>
  );
}

export function AutomationCard({
  orgId,
  meta,
  kind,
  enabled,
  params,
  count,
  lastRunLabel,
}: {
  orgId: string;
  meta: AutomationMeta;
  kind: "event" | "schedule";
  enabled: boolean;
  params: Record<string, unknown>;
  count: number;
  lastRunLabel: string | null;
}) {
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);
  const [pending, start] = useTransition();
  const [running, startRun] = useTransition();
  const [state, action] = useActionState(saveAutomationParams.bind(null, orgId, meta.key), idle);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") toast.success(state.message);
    else if (!state.fieldErrors) toast.error(state.message);
  }, [state]);

  const toggle = (value: boolean) =>
    start(async () => {
      setOptimisticEnabled(value);
      const r = await setAutomationEnabled(orgId, meta.key, value);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });

  const run = () =>
    startRun(async () => {
      const r = await runAutomationNow(orgId, meta.key);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors",
        optimisticEnabled ? "border-accent/30" : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold tracking-tight">{meta.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            {kind === "event" ? (
              <Badge tone="accent">
                <Zap className="mr-1 inline size-3" /> Al instante
              </Badge>
            ) : (
              <Badge tone="neutral">
                <CalendarClock className="mr-1 inline size-3" /> {fillText(meta.schedule ?? "Programada", params)}
              </Badge>
            )}
            {count ? (
              <span>
                {count} {count === 1 ? "acción" : "acciones"} en 30 días
              </span>
            ) : null}
            {lastRunLabel ? <span>· última {lastRunLabel}</span> : null}
          </p>
        </div>
        <Toggle
          checked={optimisticEnabled}
          disabled={pending}
          onChange={toggle}
          label={`${optimisticEnabled ? "Desactivar" : "Activar"}: ${meta.name}`}
        />
      </header>

      <div className="grid gap-2 text-[13px]">
        <p>
          <span className="mr-1.5 inline-block w-16 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cuando</span>
          {fillText(meta.when, params)}
        </p>
        <p>
          <span className="mr-1.5 inline-block w-16 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Entonces</span>
          {meta.then}
        </p>
      </div>

      {meta.params.length || kind === "schedule" ? (
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
          {meta.params.length ? (
            <form action={action} noValidate className="flex flex-wrap items-end gap-2">
              {meta.params.map((p) => (
                <Field key={p.key} label={`${p.label} (${p.suffix})`} error={state.fieldErrors?.[p.key]}>
                  <Input
                    name={p.key}
                    type="number"
                    min={p.min}
                    max={p.max}
                    step={1}
                    defaultValue={String(params[p.key] ?? "")}
                    className="h-9 w-28"
                  />
                </Field>
              ))}
              <SubmitButton size="sm" variant="secondary" pendingLabel="Guardando…">
                Guardar
              </SubmitButton>
            </form>
          ) : (
            <span />
          )}
          {kind === "schedule" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={running || !optimisticEnabled}
              onClick={run}
              title={optimisticEnabled ? "Correrla ahora, sin esperar" : "Activala para poder ejecutarla"}
            >
              {running ? <Spinner /> : <Play className="size-3.5" />} Ejecutar ahora
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
