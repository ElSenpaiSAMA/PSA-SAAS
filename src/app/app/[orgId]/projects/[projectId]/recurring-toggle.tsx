"use client";

import { Repeat } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setProjectRecurring } from "../actions";

/**
 * "Renovar la OT cada mes": para trabajos mensuales (un mantenimiento). El día 1 se
 * crea sola la OT del mes nuevo, copiada de la anterior, en borrador.
 */
export function RecurringToggle({
  orgId,
  projectId,
  enabled,
  canManage,
}: {
  orgId: string;
  projectId: string;
  enabled: boolean;
  canManage: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  const toggle = () => {
    if (!canManage) return;
    const next = !on;
    setOn(next);
    start(async () => {
      const r = await setProjectRecurring(orgId, projectId, next);
      if (r.status === "error") {
        setOn(!next);
        toast.error(r.message);
      } else toast.success(r.message);
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground")}>
          <Repeat className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium">Renovar la OT cada mes</p>
          <p className="text-[12.5px] text-muted-foreground">
            {on
              ? "El día 1 se crea sola la OT del mes nuevo (copiada de la anterior, en borrador) y avisa al responsable."
              : "Para trabajos mensuales, como un mantenimiento. Si es un trabajo puntual, dejalo apagado."}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Renovar la OT cada mes"
        aria-disabled={!canManage}
        disabled={pending}
        onClick={toggle}
        title={canManage ? undefined : "Lo decide quien gestiona el proyecto"}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-accent" : "bg-muted-foreground/30",
          canManage ? "cursor-pointer" : "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5.5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
