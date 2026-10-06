import { Check } from "lucide-react";
import { LIFECYCLE, lifecycleIndex, type BillingStatus, type WorkOrderStatus } from "@/lib/domain/work-orders";
import { cn } from "@/lib/utils";

/**
 * Ciclo de vida de una OT: Borrador → Aprobada → En curso → Cerrada → Facturada.
 * Una sola línea de estado en lugar de dos badges (estado + facturación).
 */
export function LifecycleStepper({ status, billing }: { status: WorkOrderStatus; billing: BillingStatus }) {
  const current = lifecycleIndex(status, billing);
  const finished = billing === "invoiced";

  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Ciclo de vida de la orden de trabajo">
      {LIFECYCLE.map((step, i) => {
        const done = i < current || (finished && i === current);
        const active = i === current && !finished;
        return (
          <li key={step.key} className="grid gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "h-1 rounded-full transition-colors",
                done ? "bg-success" : active ? "bg-accent" : "bg-border",
              )}
            />
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10.5px] font-semibold tabular",
                  done && "border-success bg-success text-white",
                  active && "border-accent bg-accent text-accent-foreground",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[12.5px]",
                  active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const DOT_TONE = ["bg-muted-foreground", "bg-accent", "bg-warning", "bg-danger", "bg-success"];
const LABEL_TONE = ["text-muted-foreground", "text-accent", "text-warning", "text-danger", "text-success"];

/** Versión compacta para listados: 5 segmentos + nombre del paso actual. */
export function LifecycleCompact({ status, billing }: { status: WorkOrderStatus; billing: BillingStatus }) {
  const current = lifecycleIndex(status, billing);
  // "Cerrada" sin facturar se muestra como "Por facturar": es lo accionable
  const label = status === "closed" && billing === "unbilled" ? "Por facturar" : LIFECYCLE[current].label;
  return (
    <span className="grid gap-1.5" title={`Paso ${current + 1} de ${LIFECYCLE.length}: ${LIFECYCLE[current].label}`}>
      <span className="flex gap-0.5" aria-hidden>
        {LIFECYCLE.map((step, i) => (
          <span key={step.key} className={cn("h-1 w-4 rounded-full", i <= current ? DOT_TONE[current] : "bg-border")} />
        ))}
      </span>
      <span className={cn("text-[12.5px] font-medium", LABEL_TONE[current])}>{label}</span>
    </span>
  );
}
