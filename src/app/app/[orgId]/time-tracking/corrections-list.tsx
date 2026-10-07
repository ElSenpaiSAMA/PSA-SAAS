"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/actions";
import type { TimeCorrection } from "@/lib/supabase/database.types";
import { useHydrated } from "@/lib/use-now";
import { cancelCorrection, decideCorrection } from "./actions";

const STATUS: Record<TimeCorrection["status"], { label: string; tone: BadgeTone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  approved: { label: "Aplicada", tone: "success" },
  rejected: { label: "Rechazada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export interface CorrectionView extends TimeCorrection {
  name: string;
  /** Horario anterior del tramo corregido (si corrige uno existente) */
  previous: { started_at: string; ended_at: string | null } | null;
}

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });
  return [pending, run] as const;
}

function When({ c }: { c: CorrectionView }) {
  const hydrated = useHydrated();
  // Horas en la zona del navegador: solo después de hidratar
  if (!hydrated) return <span className="text-muted-foreground">…</span>;
  const day = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "abierto");
  return (
    <span>
      <span className="capitalize">{day(c.proposed_start)}</span>{" "}
      {c.previous ? (
        <>
          <span className="text-muted-foreground line-through">
            {hm(c.previous.started_at)}–{hm(c.previous.ended_at)}
          </span>{" "}
          <ArrowRight className="inline size-3 text-muted-foreground" />{" "}
        </>
      ) : (
        <span className="text-muted-foreground">{c.entry_id ? "corrección · " : "fichaje olvidado · "}</span>
      )}
      <span className="font-medium tabular">
        {hm(c.proposed_start)}–{hm(c.proposed_end)}
      </span>
    </span>
  );
}

export function MyCorrections({ orgId, items }: { orgId: string; items: CorrectionView[] }) {
  const [pending, run] = useRun();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {items.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
          <div className="min-w-0 flex-1">
            <When c={c} />
            <p className="truncate text-[12.5px] text-muted-foreground">{c.reason}</p>
            {c.decision_note ? (
              <p className={`text-[12.5px] ${c.status === "rejected" ? "text-danger" : "text-muted-foreground"}`}>
                Respuesta: «{c.decision_note}»
              </p>
            ) : null}
          </div>
          <Badge tone={STATUS[c.status].tone} dot>
            {STATUS[c.status].label}
          </Badge>
          {c.status === "pending" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelCorrection(orgId, c.id))}
              className="text-[12.5px] text-muted-foreground underline-offset-4 hover:text-danger hover:underline disabled:opacity-50"
            >
              Cancelar
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Decision({ orgId, id }: { orgId: string; id: string }) {
  const [pending, run] = useRun();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  if (rejecting) {
    return (
      <form
        className="flex basis-full flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => decideCorrection(orgId, id, "rejected", note));
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
        <button
          type="button"
          onClick={() => setRejecting(false)}
          className="h-9 px-2 text-[13px] text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-danger px-3.5 text-[13px] font-medium text-white disabled:opacity-50"
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
        onClick={() => run(() => decideCorrection(orgId, id, "approved"))}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-foreground px-3.5 text-[13px] font-medium text-background transition-all hover:bg-foreground/90 disabled:opacity-50"
      >
        {pending ? <Spinner className="size-3.5" /> : <Check className="size-4" />} Aprobar
      </button>
    </div>
  );
}

export function TeamCorrections({ orgId, items }: { orgId: string; items: CorrectionView[] }) {
  return (
    <ul className="grid gap-2.5">
      <AnimatePresence initial={false}>
        {items.map((c) => (
          <motion.li
            key={c.id}
            layout
            exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-background p-4 text-[13.5px]"
          >
            <Avatar name={c.name} size={36} />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium">{c.name}</span> · <When c={c} />
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground">«{c.reason}»</p>
            </div>
            <Decision orgId={orgId} id={c.id} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
