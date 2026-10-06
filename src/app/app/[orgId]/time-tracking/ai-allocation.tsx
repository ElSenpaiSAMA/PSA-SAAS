"use client";

import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/submit-button";
import type { AllocationItem } from "@/lib/domain/ai";
import { applyAllocation, suggestHours } from "../ai/actions";

type Proposal = AllocationItem & { include: boolean };

/** "Repartir con IA": propone cómo imputar las horas fichadas hoy; la persona revisa y confirma. */
export function AiAllocation({ orgId, enabled }: { orgId: string; enabled: boolean }) {
  const [proposal, setProposal] = useState<Proposal[] | null>(null);
  const [available, setAvailable] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  const suggest = () =>
    startLoad(async () => {
      setNote(null);
      const r = await suggestHours(orgId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setAvailable(r.data.availableHours);
      setNote(r.data.note ?? null);
      setProposal(r.data.items.map((i) => ({ ...i, include: true })));
    });

  const chosen = (proposal ?? []).filter((p) => p.include && p.hours > 0);
  const total = chosen.reduce((s, p) => s + p.hours, 0);
  const over = total > available + 1e-9;

  const apply = () =>
    startSave(async () => {
      const r = await applyAllocation(
        orgId,
        chosen.map((p) => ({ taskId: p.taskId, hours: p.hours })),
      );
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.data} ${r.data === 1 ? "registro imputado" : "registros imputados"}`);
      setProposal(null);
    });

  if (!enabled) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-[12px] text-muted-foreground">
        <Sparkles className="size-3.5" /> Con la IA activada, Kairos te propone cómo repartir lo fichado entre tus tareas.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {proposal === null ? (
        <button
          type="button"
          onClick={suggest}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/60 px-4 text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-60"
        >
          {loading ? <Spinner /> : <Sparkles className="size-4" />}
          {loading ? "Pensando el reparto…" : "Repartir lo fichado hoy con IA"}
        </button>
      ) : null}

      <AnimatePresence>
        {proposal !== null ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium">
                <Sparkles className="size-3.5 text-accent" /> Propuesta para {available} h sin imputar
              </p>
              {note ? <p className="text-[12.5px] text-muted-foreground">{note}</p> : null}
              {proposal.map((p, i) => (
                <label
                  key={p.taskId}
                  className="grid grid-cols-[auto_minmax(0,1fr)_4.5rem] items-center gap-2.5 rounded-lg bg-card px-2.5 py-2"
                >
                  <input
                    type="checkbox"
                    checked={p.include}
                    onChange={(e) => setProposal((list) => list!.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                    aria-label={`Incluir ${p.title}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{p.title}</span>
                    {p.reason ? <span className="block truncate text-[11.5px] text-muted-foreground">{p.reason}</span> : null}
                  </span>
                  <input
                    type="number"
                    min={0.25}
                    max={12}
                    step={0.25}
                    value={p.hours}
                    onChange={(e) => setProposal((list) => list!.map((x, j) => (j === i ? { ...x, hours: Number(e.target.value) } : x)))}
                    aria-label={`Horas para ${p.title}`}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-right text-[13px] tabular"
                  />
                </label>
              ))}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className={`text-[12px] tabular ${over ? "text-danger" : "text-muted-foreground"}`}>
                  {total} h de {available} h{over ? " · te pasaste de lo fichado" : ""}
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProposal(null)}
                    className="h-8 px-2 text-[12.5px] text-muted-foreground hover:text-foreground"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={saving || over || chosen.length === 0}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12.5px] font-medium text-background disabled:opacity-40"
                  >
                    {saving ? <Spinner className="size-3" /> : null} Imputar {chosen.length ? `(${chosen.length})` : ""}
                  </button>
                </span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
