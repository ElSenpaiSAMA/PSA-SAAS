"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";
import { businessDays, type VacationStatus } from "@/lib/domain/vacations";
import type { VacationRequest } from "@/lib/supabase/database.types";
import { cancelVacation, decideVacation } from "./actions";

const STATUS: Record<VacationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  approved: { label: "Aprobada", tone: "success" },
  rejected: { label: "Rechazada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

function range(r: Pick<VacationRequest, "start_date" | "end_date">) {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return r.start_date === r.end_date ? fmt(r.start_date) : `${fmt(r.start_date)} — ${fmt(r.end_date)}`;
}

function useAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });
  return [pending, run] as const;
}

export function MyRequests({ orgId, requests }: { orgId: string; requests: VacationRequest[] }) {
  return (
    <ul className="divide-y divide-border">
      <AnimatePresence initial={false}>
        {requests.map((r) => (
          <motion.li key={r.id} layout className="flex items-center gap-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">{range(r)}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {businessDays(r)} días hábiles{r.reason ? ` · ${r.reason}` : ""}
              </p>
            </div>
            <Badge tone={STATUS[r.status].tone} dot>
              {STATUS[r.status].label}
            </Badge>
            {r.status === "pending" ? <CancelButton orgId={orgId} id={r.id} /> : null}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function CancelButton({ orgId, id }: { orgId: string; id: string }) {
  const [pending, run] = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => cancelVacation(orgId, id))}
      className="text-[12.5px] text-muted-foreground underline-offset-4 transition-colors hover:text-danger hover:underline disabled:opacity-50"
    >
      {pending ? "Cancelando…" : "Cancelar"}
    </button>
  );
}

export interface PendingApproval extends VacationRequest {
  name: string;
  position: string | null;
  available: number;
}

export function Approvals({ orgId, requests }: { orgId: string; requests: PendingApproval[] }) {
  return (
    <ul className="grid gap-2.5">
      <AnimatePresence initial={false}>
        {requests.map((r) => (
          <motion.li
            key={r.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-background p-4"
          >
            <Avatar name={r.name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px]">
                <span className="font-medium">{r.name}</span>{" "}
                <span className="text-muted-foreground">· {range(r)}</span>
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {businessDays(r)} días hábiles · le quedan {r.available}
                {r.reason ? ` · “${r.reason}”` : ""}
              </p>
            </div>
            <DecisionButtons orgId={orgId} id={r.id} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function DecisionButtons({ orgId, id }: { orgId: string; id: string }) {
  const [pending, run] = useAction();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => decideVacation(orgId, id, "rejected"))}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] text-muted-foreground transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        <X className="size-4" /> Rechazar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => decideVacation(orgId, id, "approved"))}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-foreground px-3.5 text-[13px] font-medium text-background transition-all hover:bg-foreground/90 active:scale-[0.97] disabled:opacity-50"
      >
        {pending ? <Spinner className="size-3.5" /> : <Check className="size-4" />} Aprobar
      </button>
    </div>
  );
}
