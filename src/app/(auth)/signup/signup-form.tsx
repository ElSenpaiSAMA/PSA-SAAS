"use client";

import { ArrowRight, Check } from "lucide-react";
import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { signUp } from "../actions";
import { FormAlert } from "@/components/ui/form-alert";

const rules = [
  { label: "8+ caracteres", test: (v: string) => v.length >= 8 },
  { label: "Una letra", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "Un número", test: (v: string) => /\d/.test(v) },
];

export function SignupForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action] = useActionState(signUp, idle);
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="mt-8 grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field label="Nombre completo" error={state.fieldErrors?.fullName}>
        <Input name="fullName" autoComplete="name" placeholder="Ana Torres" autoFocus required />
      </Field>
      <Field label="Email de trabajo" error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" placeholder="vos@diplonautic.com" defaultValue={defaultEmail} required />
      </Field>
      <Field label="Contraseña" error={state.fieldErrors?.password}>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <ul className="-mt-1 flex flex-wrap gap-x-4 gap-y-1" aria-label="Requisitos de contraseña">
        {rules.map((r) => {
          const passed = r.test(password);
          return (
            <li
              key={r.label}
              className={cn(
                "flex items-center gap-1.5 text-[12px] transition-colors duration-300",
                passed ? "text-success" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-full border transition-all duration-300",
                  passed ? "scale-100 border-success bg-success text-background" : "border-border-strong",
                )}
              >
                {passed ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
              {r.label}
            </li>
          );
        })}
      </ul>
      <SubmitButton className="group mt-2 w-full bg-blue-600 text-white hover:bg-blue-500" size="lg" pendingLabel="Activando…">
        Activar cuenta
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </SubmitButton>
    </form>
  );
}
