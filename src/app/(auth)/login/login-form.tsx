"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { signIn } from "../actions";
import { FormAlert } from "@/components/ui/form-alert";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, idle);

  return (
    <form action={action} className="mt-8 grid gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormAlert state={state} />
      <Field label="Email" error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" placeholder="vos@empresa.com" autoFocus required />
      </Field>
      <Field label="Contraseña" error={state.fieldErrors?.password}>
        <Input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </Field>
      <SubmitButton className="group mt-2 w-full" size="lg" pendingLabel="Ingresando…">
        Ingresar
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </SubmitButton>
      <DemoHint />
    </form>
  );
}

function DemoHint() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") return null;
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Demo:</span> laura@demo.com · carlos@demo.com · ana@demo.com — contraseña{" "}
      <span className="font-mono">Demo1234!</span>
    </p>
  );
}
