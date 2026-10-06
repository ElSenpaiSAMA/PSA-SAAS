"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";
import { ABSENCE_LABEL, businessDays, type VacationStatus } from "@/lib/domain/vacations";
import type { VacationRequest } from "@/lib/supabase/database.types";
import { cancelVacation, decideVacation } from "./actions";

const STATUS: Record<VacationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  approved: { label: "Aprobada", tone: "success" },
  rejected: { label: "Rechazada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

const daysLabel = (n: number) => `${n} ${n === 1 ? "día hábil" : "días hábiles"}`;

function range(r: Pick<VacationRequest, "start_date" | "end_date">) {
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
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

export function MyRequests({ orgId, requests, holidays }: { orgId: string; requests: VacationRequest[]; holidays: string[] }) {
  const off = new Set(holidays);
  return (
    <ul className="divide-y divide-border">
      <AnimatePresence initial={false}>
        {requests.map((r) => (
          <motion.li key={r.id} layout className="flex items-center gap-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">
                {range(r)} {r.kind !== "vacation" ? <span className="font-normal text-muted-foreground">· {ABSENCE_LABEL[r.kind]}</span> : null}
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {daysLabel(businessDays(r, off))}{r.reason ? ` · ${r.reason}` : ""}
              </p>
              {r.decision_note ? (
                <p className={`mt-1 text-[12.5px] ${r.status === "rejected" ? "text-danger" : "text-muted-foreground"}`}>
                  Respuesta: «{r.decision_note}»
                </p>
              ) : null}
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
  /** Otras personas del equipo ausentes esos días */
  overlaps?: string[];
  /** Si la decisión le corresponde a otra persona (aprobador natural) */
  approverName?: string | null;
}

export function Approvals({ orgId, requests, holidays }: { orgId: string; requests: PendingApproval[]; holidays: string[] }) {
  const off = new Set(holidays);
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
                <span className="font-medium">{r.name}</span> <span className="text-muted-foreground">· {range(r)}</span>
                {r.kind !== "vacation" ? (
                  <Badge tone={r.kind === "sick" ? "danger" : "accent"} className="ml-2">
                    {ABSENCE_LABEL[r.kind]}
                  </Badge>
                ) : null}
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {daysLabel(businessDays(r, off))}{r.kind === "vacation" ? ` · le quedan ${r.available}` : " · no descuenta vacaciones"}
                {r.reason ? ` · “${r.reason}”` : ""}
              </p>
              {r.overlaps || r.approverName ? (
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {r.overlaps?.length ? (
                    <Badge tone="warning">Coincide con {r.overlaps.join(", ")}</Badge>
                  ) : (
                    <Badge tone="success">Sin coincidencias en el equipo</Badge>
                  )}
                  {r.approverName ? <Badge tone="neutral">Le toca a {r.approverName}</Badge> : null}
                </p>
              ) : null}
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
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  if (rejecting) {
    return (
      <form
        className="flex basis-full flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => decideVacation(orgId, id, "rejected", note));
        }}
      >
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          aria-label="Motivo del rechazo"
          placeholder="¿Por qué la rechazás? La persona lo va a ver"
          className="h-9 min-w-60 flex-1 rounded-xl border border-border bg-card px-3 text-[13px] outline-none focus:border-border-strong"
        />
        <button type="button" onClick={() => setRejecting(false)} className="h-9 px-2 text-[13px] text-muted-foreground hover:text-foreground">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-danger px-3.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
        >
          {pending ? <Spinner className="size-3.5" /> : <X className="size-4" />} Confirmar rechazo
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setRejecting(true)}
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
