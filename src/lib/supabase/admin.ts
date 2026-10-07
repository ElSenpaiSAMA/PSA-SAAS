import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente con la clave `service_role`: SOLO para enviar el email de invitación
 * (Supabase Auth). Es opcional: sin SUPABASE_SERVICE_ROLE_KEY la app funciona igual
 * y el admin comparte el enlace de activación a mano. La clave nunca llega al
 * navegador (no es NEXT_PUBLIC_ y este módulo es server-only).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
