"use client";

import { Repeat } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import { copyPreviousMonth } from "./actions";

/**
 * Aviso de recurrencia: OT del mes anterior que todavía no tienen su OT en este
 * mes. Un clic las copia todas (con sus tareas) al mes visible.
 */
export function CopyPreviousBanner({
  orgId,
  month,
  monthLabel,
  previousLabel,
  titles,
}: {
  orgId: string;
  /** "YYYY-MM" */
  month: string;
  monthLabel: string;
  previousLabel: string;
  titles: string[];
}) {
  const [pending, start] = useTransition();
  const n = titles.length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent-soft/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-card text-accent">
          <Repeat className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium">
            {n === 1 ? "1 OT" : `${n} OT`} de {previousLabel} {n === 1 ? "no tiene" : "no tienen"} continuación en {monthLabel}
          </p>
          <p className="truncate text-[12.5px] text-muted-foreground">{titles.join(" · ")}</p>
        </div>
      </div>
      <Button
        variant="accent"
        disabled={pending}
        className="shrink-0"
        onClick={() =>
          start(async () => {
            const r = await copyPreviousMonth(orgId, month);
            if (r.status === "error") toast.error(r.message);
            else toast.success(r.message);
          })
        }
      >
        {pending ? <Spinner /> : null}
        {n === 1 ? `Copiarla a ${monthLabel}` : `Copiar las ${n} a ${monthLabel}`}
      </Button>
    </div>
  );
}
