"use server";

import { redirect } from "next/navigation";
import { fail, ok, type ActionState } from "@/lib/actions";
import { safeNextPath } from "@/lib/domain/redirect";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/validation/schemas";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensaje genérico: no revelamos si el email existe
    return fail("Email o contraseña incorrectos.");
  }

  await supabase.rpc("log_event", { p_action: "auth.login" });
  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { fullName, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${env.siteUrl}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return fail("Ya existe una cuenta con ese email.", { email: ["Ya registrado"] });
    }
    if (error.status === 429 || error.message.toLowerCase().includes("rate limit")) {
      return fail("Hubo demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.");
    }
    // La base rechaza el alta sin invitación (0017_single_company); Auth lo informa como error de base
    if (error.message.toLowerCase().includes("database error")) {
      return fail("Este email no tiene una invitación de Diplonautic. Pedile acceso a la administración.", {
        email: ["Sin invitación pendiente"],
      });
    }
    return fail("No pudimos crear la cuenta. Probá de nuevo.");
  }

  // Con confirmación de email activada no hay sesión todavía
  if (!data.session) {
    return ok("Te enviamos un email para confirmar tu cuenta.");
  }

  await supabase.rpc("log_event", { p_action: "auth.signup" });
  redirect("/select-organization");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.rpc("log_event", { p_action: "auth.logout" });
  await supabase.auth.signOut();
  redirect("/");
}
