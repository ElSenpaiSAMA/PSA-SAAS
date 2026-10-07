"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const rules = [
  { label: "8+ caracteres", test: (v: string) => v.length >= 8 },
  { label: "Una letra", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "Un número", test: (v: string) => /\d/.test(v) },
];

type Status = "checking" | "ready" | "invalid";

/**
 * El enlace del email de Supabase vuelve con la sesión en el fragmento (#access_token=…).
 * Se toma en el navegador, se guarda la sesión y se pide nombre y contraseña.
 */
export function ActivateForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    (async () => {
      if (access && refresh) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
        // Sacar los tokens de la barra de direcciones
        window.history.replaceState(null, "", window.location.pathname);
        if (sessionError) return setStatus("invalid");
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setStatus("invalid");
      setEmail(data.user.email ?? "");
      setName((data.user.user_metadata?.full_name as string | undefined) ?? "");
      setStatus("ready");
    })();
  }, []);

  const valid = name.trim().length >= 2 && rules.every((r) => r.test(password));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError("Completá tu nombre y una contraseña que cumpla los requisitos.");
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase.auth.updateUser({ password, data: { full_name: name.trim() } });
    if (updateError || !data.user) {
      setSaving(false);
      return setError("No pudimos guardar la contraseña. Probá de nuevo.");
    }
    await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", data.user.id);
    router.replace("/select-organization");
  }

  if (status === "checking") return <p className="mt-8 text-[14px] text-slate-500">Verificando tu invitación…</p>;

  if (status === "invalid") {
    return (
      <div className="mt-8 rounded-xl border border-danger/30 bg-danger/5 p-4 text-[14px]">
        <p className="font-medium text-danger">El enlace expiró o ya se usó.</p>
        <p className="mt-1 text-slate-600">
          Pedile a la administración que te reenvíe la invitación, o{" "}
          <Link href="/login" className="font-medium text-blue-700 underline-offset-4 hover:underline">
            iniciá sesión
          </Link>{" "}
          si ya activaste tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">{error}</p> : null}
      <Field label="Email">
        <Input value={email} disabled readOnly />
      </Field>
      <Field label="Nombre completo">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Marc Vidal" autoFocus />
      </Field>
      <Field label="Contraseña">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
      </Field>
      <ul aria-label="Requisitos de contraseña" className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {rules.map((r) => (
          <li key={r.label} className={cn("inline-flex items-center gap-1", r.test(password) ? "text-success" : "text-slate-400")}>
            <Check className="size-3.5" /> {r.label}
          </li>
        ))}
      </ul>
      <Button type="submit" size="lg" disabled={saving} className="group mt-2 w-full bg-blue-600 text-white hover:bg-blue-500">
        {saving ? "Activando…" : "Entrar a la intranet"}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </form>
  );
}
