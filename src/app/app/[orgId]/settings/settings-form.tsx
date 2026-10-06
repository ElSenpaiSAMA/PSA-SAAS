"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { TIMEZONES } from "@/lib/validation/schemas";
import { saveOrgSettings } from "./actions";

const TZ_LABEL: Record<string, string> = {
  "Europe/Madrid": "Madrid",
  "Europe/Lisbon": "Lisboa",
  "Europe/London": "Londres",
  "Atlantic/Canary": "Canarias",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Mexico_City": "Ciudad de México",
  "America/Bogota": "Bogotá",
  "America/Santiago": "Santiago de Chile",
  "America/Lima": "Lima",
  "America/Montevideo": "Montevideo",
  "America/New_York": "Nueva York",
  UTC: "UTC",
};

export function SettingsForm({
  orgId,
  values,
}: {
  orgId: string;
  values: { name: string; timezone: string; defaultAnnualVacationDays: number; defaultWeeklyHours: number };
}) {
  const [state, action] = useActionState(saveOrgSettings.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") toast.success(state.message);
    else if (!state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <form action={action} noValidate className="grid gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Empresa</legend>
        <Field label="Nombre" error={state.fieldErrors?.name}>
          <Input name="name" defaultValue={values.name} maxLength={60} />
        </Field>
        <Field label="Zona horaria" hint="Para recordatorios y resúmenes automáticos" error={state.fieldErrors?.timezone}>
          <Select name="timezone" defaultValue={values.timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {TZ_LABEL[tz] ?? tz}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Para quien se suma</legend>
        <p className="mb-2 text-[12.5px] text-muted-foreground sm:col-span-2">
          Se aplican a las personas que acepten una invitación desde ahora. A quienes ya están se les cambia desde Personas.
        </p>
        <Field label="Días de vacaciones al año" error={state.fieldErrors?.defaultAnnualVacationDays}>
          <Input name="defaultAnnualVacationDays" type="number" min={0} max={60} step={1} defaultValue={values.defaultAnnualVacationDays} />
        </Field>
        <Field label="Jornada semanal (horas)" error={state.fieldErrors?.defaultWeeklyHours}>
          <Input name="defaultWeeklyHours" type="number" min={1} max={60} step={0.5} defaultValue={values.defaultWeeklyHours} />
        </Field>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Guardar ajustes</SubmitButton>
      </div>
    </form>
  );
}
