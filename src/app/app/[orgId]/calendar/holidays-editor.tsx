"use client";

import { AnimatePresence, motion } from "motion/react";
import { PartyPopper, X } from "lucide-react";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { formatRange } from "@/lib/domain/periods";
import { addHoliday, deleteHoliday } from "./actions";

interface HolidayItem {
  id: string;
  date: string;
  name: string;
}

export function HolidaysEditor({ orgId, year, holidays }: { orgId: string; year: number; holidays: HolidayItem[] }) {
  const [state, action] = useActionState(addHoliday.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") toast.success(state.message);
    else if (!state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <ul className="grid content-start gap-1.5 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {holidays.map((h) => (
            <HolidayRow key={h.id} orgId={orgId} holiday={h} />
          ))}
        </AnimatePresence>
        {holidays.length === 0 ? <p className="text-[13px] text-muted-foreground">No hay festivos cargados para {year}.</p> : null}
      </ul>
      <form
        key={state.status === "success" ? state.submittedAt : "draft"}
        action={action}
        noValidate
        className="grid h-fit gap-3 rounded-2xl border border-dashed border-border-strong p-4"
      >
        <p className="text-[13px] font-medium">Agregar festivo</p>
        <Field label="Fecha" error={state.fieldErrors?.date}>
          <Input name="date" type="date" min={`${year}-01-01`} max={`${year + 1}-12-31`} />
        </Field>
        <Field label="Nombre" error={state.fieldErrors?.name}>
          <Input name="name" placeholder="Ej: Fiesta local" />
        </Field>
        <SubmitButton pendingLabel="Guardando…">Agregar</SubmitButton>
      </form>
    </div>
  );
}

function HolidayRow({ orgId, holiday }: { orgId: string; holiday: HolidayItem }) {
  const [pending, start] = useTransition();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="group flex items-center gap-3 rounded-xl border border-border px-3 py-2"
    >
      <PartyPopper className="size-4 shrink-0 text-danger" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{holiday.name}</p>
        <p className="text-[12px] text-muted-foreground">{formatRange(holiday.date, holiday.date)}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        aria-label={`Eliminar ${holiday.name}`}
        onClick={() =>
          start(async () => {
            const r = await deleteHoliday(orgId, holiday.id);
            if (r.status === "error") toast.error(r.message);
            else toast.success(r.message);
          })
        }
        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </motion.li>
  );
}
