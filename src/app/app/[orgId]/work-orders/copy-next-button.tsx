"use client";

import { CopyPlus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { copyToNextPeriod } from "./actions";

/** Copia la OT (con sus tareas) al período siguiente y navega a la copia. */
export function CopyNextButton({
  orgId,
  workOrderId,
  targetLabel,
  variant = "text",
}: {
  orgId: string;
  workOrderId: string;
  /** Mes destino, p. ej. "Noviembre 2026" */
  targetLabel: string;
  variant?: "text" | "full";
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={`Crear la OT de ${targetLabel} con las mismas tareas`}
      onClick={() =>
        start(async () => {
          const r = await copyToNextPeriod(orgId, workOrderId);
          // Si sale bien, la acción redirige a la OT nueva
          if (r?.status === "error") toast.error(r.message);
        })
      }
      className={cn(
        "relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-50",
        variant === "text"
          ? "h-8 rounded-lg px-2.5 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
          : "h-10 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:border-border-strong",
      )}
    >
      {pending ? <Spinner /> : <CopyPlus className="size-3.5" strokeWidth={1.75} />}
      Copiar a {targetLabel}
    </button>
  );
}
