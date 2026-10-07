"use client";

import { Camera, Laptop, Moon, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { isGroupEnabled, NOTIFICATION_GROUPS } from "@/lib/domain/notification-prefs";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { setAvatar, setNotificationPrefs, updateProfile } from "./actions";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const OUTPUT_SIZE = 320;

/** Recorta al centro en cuadrado y la achica a 320 px en WebP: liviana y nítida en cualquier avatar. */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  g.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/webp", 0.88));
}

export function AvatarEditor({ orgId, userId, name, avatar }: { orgId: string; userId: string; name: string; avatar: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const path = `${userId}/avatar.webp`;

  const upload = (file: File) =>
    start(async () => {
      if (!file.type.startsWith("image/")) return void toast.error("Elegí una imagen (JPG, PNG o WebP).");
      if (file.size > MAX_INPUT_BYTES) return void toast.error("La imagen pesa demasiado (máximo 8 MB).");
      try {
        const blob = await toSquareWebp(file);
        const supabase = createClient();
        // Siempre el mismo archivo: se reemplaza y no quedan fotos viejas en Storage
        const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/webp" });
        if (error) return void toast.error("No se pudo subir la foto.");
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        // El parámetro de versión evita que el navegador muestre la foto anterior en caché
        const r = await setAvatar(orgId, `${data.publicUrl}?v=${Date.now()}`);
        if (r.status === "error") toast.error(r.message);
        else toast.success(r.message);
      } catch {
        toast.error("No se pudo leer la imagen.");
      }
    });

  const remove = () =>
    start(async () => {
      await createClient().storage.from("avatars").remove([path]);
      const r = await setAvatar(orgId, null);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        aria-label="Cambiar foto de perfil"
        className="group relative rounded-full focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <Avatar name={name} src={avatar} size={88} className="ring-4" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="size-6" strokeWidth={1.75} />
        </span>
        {pending ? <span className="absolute inset-0 animate-pulse rounded-full bg-background/50" /> : null}
      </button>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
            <Camera className="size-3.5" /> {avatar ? "Cambiar foto" : "Subir foto"}
          </Button>
          {avatar ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={remove}>
              <Trash2 className="size-3.5" /> Quitar
            </Button>
          ) : null}
        </div>
        <p className="text-[12px] text-muted-foreground">JPG, PNG o WebP. Se recorta en cuadrado automáticamente.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
    </div>
  );
}

export function NameForm({ orgId, fullName, email }: { orgId: string; fullName: string; email: string }) {
  const [state, action] = useActionState(updateProfile.bind(null, orgId), idle);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Nombre y apellido" error={state.fieldErrors?.fullName} className="content-start">
        <Input name="fullName" defaultValue={fullName} autoComplete="name" maxLength={80} />
      </Field>
      <Field label="Email" hint="Es tu usuario para entrar. Lo cambia administración." className="content-start">
        <Input value={email} readOnly disabled />
      </Field>
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {state.status === "success" ? <p className="text-[12.5px] text-success">{state.message}</p> : null}
        {state.status === "error" && !state.fieldErrors ? <p className="text-[12.5px] text-danger">{state.message}</p> : null}
        <SubmitButton size="sm" pendingLabel="Guardando…">
          Guardar cambios
        </SubmitButton>
      </div>
    </form>
  );
}

const THEMES = [
  { value: "system", label: "Automático", hint: "Como tu sistema", icon: Laptop },
  { value: "light", label: "Claro", hint: "Fondo blanco", icon: Sun },
  { value: "dark", label: "Oscuro", hint: "Para poca luz", icon: Moon },
] as const;

export function ThemePreference() {
  const { theme, setTheme } = useTheme();
  // El tema real solo se conoce en el navegador
  const hydrated = useHydrated();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid gap-2 sm:grid-cols-3">
      {THEMES.map((t) => {
        const active = hydrated && (theme ?? "system") === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t.value)}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
              active ? "border-accent bg-accent-soft/50" : "border-border hover:border-border-strong hover:bg-muted/50",
            )}
          >
            <t.icon className={cn("size-[18px]", active ? "text-accent" : "text-muted-foreground")} strokeWidth={1.75} />
            <span>
              <span className="block text-[13.5px] font-medium">{t.label}</span>
              <span className="block text-[12px] text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function NotificationPrefs({ orgId, muted, permissions }: { orgId: string; muted: string[]; permissions: string[] }) {
  const groups = NOTIFICATION_GROUPS.filter((g) => !g.permission || permissions.includes(g.permission));
  const [disabled, setDisabled] = useState(() => groups.filter((g) => !isGroupEnabled(g, muted)).map((g) => g.key));
  const [pending, start] = useTransition();

  const toggle = (key: string) => {
    const next = disabled.includes(key) ? disabled.filter((k) => k !== key) : [...disabled, key];
    setDisabled(next);
    start(async () => {
      const r = await setNotificationPrefs(orgId, next);
      if (r.status === "error") {
        setDisabled(disabled);
        toast.error(r.message);
      }
    });
  };

  return (
    <ul className="divide-y divide-border" aria-busy={pending}>
      {groups.map((g) => {
        const on = !disabled.includes(g.key);
        return (
          <li key={g.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium">{g.label}</p>
              <p className="text-[12.5px] text-muted-foreground">{g.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={g.label}
              onClick={() => toggle(g.key)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                on ? "bg-accent" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 rounded-full bg-white shadow transition-transform",
                  on ? "translate-x-5.5" : "translate-x-0.5",
                )}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
