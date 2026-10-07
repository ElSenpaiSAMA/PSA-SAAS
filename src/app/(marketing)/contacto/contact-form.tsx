"use client";

import { CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { BOAT_TYPES, CONTACT_SERVICES } from "@/lib/validation/schemas";
import { sendContact } from "./actions";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ContactForm() {
  const [state, action] = useActionState(sendContact, idle);
  // Tras enviar se muestra la confirmación; "Enviar otra consulta" vuelve al formulario vacío
  const [dismissed, setDismissed] = useState<number | undefined>();
  const sent = state.status === "success" && state.submittedAt !== dismissed;
  const errors = state.fieldErrors;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div
          key="sent"
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col items-center px-4 py-14 text-center"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-success/12 text-success">
            <CheckCircle2 className="size-7" strokeWidth={1.75} />
          </div>
          <h2 className="mt-5 text-[22px] font-semibold tracking-tight">Mensaje recibido</h2>
          <p className="mt-2 max-w-sm text-[14.5px] text-muted-foreground">{state.message}</p>
          <Button variant="secondary" className="mt-8" onClick={() => setDismissed(state.submittedAt)}>
            Enviar otra consulta
          </Button>
        </motion.div>
      ) : (
        <motion.form
          key={`form-${dismissed ?? 0}`}
          action={action}
          noValidate
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="grid gap-5 sm:grid-cols-2"
          aria-label="Formulario de contacto"
        >
          <Field label="Nombre y apellido" error={errors?.name}>
            <Input name="name" autoComplete="name" placeholder="Marta Soler" />
          </Field>
          <Field label="Email" error={errors?.email}>
            <Input name="email" type="email" autoComplete="email" placeholder="marta@correo.com" />
          </Field>
          <Field label="Teléfono" error={errors?.phone} hint="Opcional, si preferís que te llamemos.">
            <Input name="phone" type="tel" autoComplete="tel" placeholder="+34 600 000 000" />
          </Field>
          <Field label="Tipo de barco" error={errors?.boatType}>
            <Select name="boatType" defaultValue="">
              <option value="" disabled>
                Elegí uno
              </option>
              {BOAT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Modelo y eslora" error={errors?.boatModel} hint="Opcional. Ej.: Princess V58, 18 m.">
            <Input name="boatModel" placeholder="Modelo, eslora o año" />
          </Field>
          <Field label="Servicio" error={errors?.service}>
            <Select name="service" defaultValue="">
              <option value="" disabled>
                ¿Qué necesitás?
              </option>
              {CONTACT_SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Mensaje" error={errors?.message} className="sm:col-span-2">
            <Textarea name="message" rows={5} maxLength={2000} placeholder="Contanos qué equipo falla, dónde está amarrado el barco y cuándo lo necesitás." />
          </Field>

          {/* Campo trampa para bots: invisible y fuera del orden de tabulación */}
          <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>
              No completar <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <label className="flex items-start gap-2.5 text-[13.5px] text-muted-foreground">
              <input
                type="checkbox"
                name="privacy"
                className="mt-0.5 size-4 accent-foreground"
                aria-invalid={!!errors?.privacy}
                aria-describedby={errors?.privacy ? "privacy-error" : undefined}
              />
              Acepto que Diplonautic use estos datos solo para responder a mi consulta.
            </label>
            {errors?.privacy ? (
              <p id="privacy-error" className="text-[12.5px] text-danger">
                {errors.privacy[0]}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse items-start justify-between gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <p className="text-[12.5px] text-muted-foreground">Respondemos en menos de 24 horas laborables.</p>
            <SubmitButton pendingLabel="Enviando…" className="bg-blue-600 text-white hover:bg-blue-500">
              Enviar consulta
            </SubmitButton>
          </div>
          {state.status === "error" && !errors ? <p className="text-[13px] text-danger sm:col-span-2">{state.message}</p> : null}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
