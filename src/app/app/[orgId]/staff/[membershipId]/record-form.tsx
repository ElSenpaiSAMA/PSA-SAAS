"use client";

import { AnimatePresence, motion } from "motion/react";
import { Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { CONTRACT_LABEL, FIELD_LABEL, type RecordField } from "@/lib/domain/employee-records";
import { saveEmployeeRecord } from "../actions";

type Values = Partial<Record<RecordField, string | number | null>>;

const INPUT: Partial<
  Record<
    RecordField,
    {
      type?: string;
      placeholder?: string;
      inputMode?: "numeric" | "decimal" | "tel" | "email";
    }
  >
> = {
  national_id: { placeholder: "12345678Z" },
  birth_date: { type: "date" },
  phone: { type: "tel", placeholder: "+34 600 000 000", inputMode: "tel" },
  personal_email: {
    type: "email",
    placeholder: "nombre@correo.com",
    inputMode: "email",
  },
  address: { placeholder: "Calle, número, ciudad" },
  emergency_contact: { placeholder: "Nombre · teléfono" },
  hire_date: { type: "date" },
  salary_annual: { inputMode: "decimal", placeholder: "Ej: 34000" },
  iban: { placeholder: "ES00 0000 0000 0000 0000 0000" },
};

const SECTIONS: { title: string; fields: RecordField[] }[] = [
  {
    title: "Identidad y contacto",
    fields: ["national_id", "birth_date", "phone", "personal_email", "address", "emergency_contact"],
  },
  {
    title: "Contrato y retribución",
    fields: ["hire_date", "contract_type", "salary_annual", "iban"],
  },
];

/**
 * Edición de la ficha. No sobrescribe: guarda una versión nueva vigente desde
 * la fecha elegida, así el historial muestra qué cambió y desde cuándo.
 */
export function RecordForm({
  orgId,
  membershipId,
  current,
  today,
}: {
  orgId: string;
  membershipId: string;
  current: Values | null;
  today: string;
}) {
  const [state, action] = useActionState(saveEmployeeRecord.bind(null, orgId, membershipId), idle);
  // Se abre "a partir" del último envío: un guardado exitoso posterior lo cierra solo
  const [openedAfter, setOpenedAfter] = useState<number | null>(null);
  const open = openedAfter !== null && !(state.status === "success" && (state.submittedAt ?? 0) !== openedAfter);
  const setOpen = (value: boolean) => setOpenedAfter(value ? (state.submittedAt ?? 0) : null);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") toast.success(state.message);
    else if (!state.fieldErrors) toast.error(state.message);
  }, [state]);

  const value = (f: RecordField) => (current?.[f] ?? "") as string | number;

  return (
    <div>
      {!open ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" /> {current ? "Registrar un cambio" : "Completar ficha"}
        </Button>
      ) : null}
      <AnimatePresence>
        {open ? (
          <motion.form
            action={action}
            noValidate
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-5 pt-1">
              <div className="rounded-xl bg-muted/60 p-3">
                <Field label="Vigente desde" error={state.fieldErrors?.effectiveFrom}>
                  <Input name="effectiveFrom" type="date" defaultValue={today} />
                </Field>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  Por ejemplo, la fecha de una subida de sueldo. Las versiones anteriores se conservan en el historial.
                </p>
              </div>

              {SECTIONS.map((section) => (
                <fieldset key={section.title} className="grid gap-3">
                  <legend className="mb-1 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">{section.title}</legend>
                  {section.fields.map((f) =>
                    f === "contract_type" ? (
                      <Field key={f} label={FIELD_LABEL[f]} error={state.fieldErrors?.[f]}>
                        <Select name={f} defaultValue={String(value(f))}>
                          <option value="">Sin definir</option>
                          {Object.entries(CONTRACT_LABEL).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ) : (
                      <Field key={f} label={FIELD_LABEL[f]} error={state.fieldErrors?.[f]}>
                        <Input name={f} defaultValue={value(f)} autoComplete="off" {...INPUT[f]} />
                      </Field>
                    ),
                  )}
                </fieldset>
              ))}

              <Field label="Motivo del cambio" error={state.fieldErrors?.notes}>
                <Input name="notes" placeholder="Ej: revisión salarial anual" autoComplete="off" />
              </Field>

              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <SubmitButton pendingLabel="Guardando…">Guardar versión</SubmitButton>
              </div>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
