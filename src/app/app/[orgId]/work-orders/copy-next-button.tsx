"use client";

import { CopyPlus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { copyToNextPeriod } from "./actions";

/** "Copiar al mes siguiente": duplica la OT con sus tareas y navega a la copia. */
export function CopyNextButton({
  orgId,
  workOrderId,
  variant = "icon",
}: {
  orgId: string;
  workOrderId: string;
  variant?: "icon" | "full";
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Copiar al mes siguiente"
      aria-label="Copiar al mes siguiente"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          const r = await copyToNextPeriod(orgId, workOrderId);
          // Si sale bien, la acción redirige a la OT nueva
          if (r?.status === "error") toast.error(r.message);
        });
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50",
        variant === "icon" ? "size-8" : "h-10 border border-border bg-card px-4 text-sm font-medium text-foreground hover:border-border-strong",
      )}
    >
      {pending ? <Spinner /> : <CopyPlus className="size-4" strokeWidth={1.75} />}
      {variant === "full" ? "Copiar al mes siguiente" : null}
    </button>
  );
}
