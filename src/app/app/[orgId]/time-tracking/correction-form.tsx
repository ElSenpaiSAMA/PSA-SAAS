"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { requestCorrection } from "./actions";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Fecha + hora del navegador → instante ISO (con la zona horaria de quien ficha). */
const toIso = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`).toISOString() : "");

/**
 * Pide una corrección: si viene `entry`, corrige ese tramo (precargado);
 * si no, agrega un fichaje olvidado de la fecha elegida.
 */
export function CorrectionForm({
  orgId,
  entry,
  onDone,
}: {
  orgId: string;
  entry?: { id: string; started_at: string; ended_at: string | null };
  onDone: () => void;
}) {
  const [state, action] = useActionState(requestCorrection.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);
  const initialStart = entry ? new Date(entry.started_at) : null;
  const initialEnd = entry?.ended_at ? new Date(entry.ended_at) : null;
  // Inicializadores perezosos: la fecha de hoy se lee una sola vez, al abrir el formulario
  const [today] = useState(() => localDate(new Date()));
  const [date, setDate] = useState(() => localDate(initialStart ?? new Date(Date.now() - 86_400_000)));
  const [start, setStart] = useState(initialStart ? localTime(initialStart) : "09:00");
  const [end, setEnd] = useState(initialEnd ? localTime(initialEnd) : "18:00");

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    } else if (!state.fieldErrors) toast.error(state.message);
  }, [state, onDone]);

  // Si la salida es "antes" que la entrada, se interpreta como el día siguiente (turno nocturno)
  const startIso = toIso(date, start);
  let endIso = toIso(date, end);
  if (startIso && endIso && endIso <= startIso) {
    const next = new Date(`${date}T00:00`);
    next.setDate(next.getDate() + 1);
    endIso = toIso(localDate(next), end);
  }

  return (
    <form action={action} noValidate className="grid gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
      <input type="hidden" name="entryId" value={entry?.id ?? ""} />
      <input type="hidden" name="start" value={startIso} />
      <input type="hidden" name="end" value={endIso} />
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
        <Field label="Día" error={state.fieldErrors?.start}>
          <Input type="date" value={date} max={today} disabled={!!entry} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Entrada">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Hora de entrada" />
        </Field>
        <Field label="Salida" error={state.fieldErrors?.end}>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Hora de salida" />
        </Field>
      </div>
      <Field label="Motivo" error={state.fieldErrors?.reason}>
        <Input
          name="reason"
          placeholder={entry ? "Ej: entré a las 8 y me olvidé de fichar" : "Ej: estuve en un cliente y no pude fichar"}
          maxLength={300}
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">La revisa tu responsable. Hasta que la apruebe, el fichaje no cambia.</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDone} className="h-9 px-2 text-[13px] text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <SubmitButton size="sm" pendingLabel="Enviando…">
            Pedir corrección
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
