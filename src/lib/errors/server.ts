import "server-only";
import { headers } from "next/headers";
import { knownDbError, UNEXPECTED_ERROR } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { normalizeError, type ErrorSource } from "./normalize";

/**
 * Registra un error en public.error_logs (lo lee el superadmin en "Errores").
 * Nunca lanza: si no se puede registrar, queda en la consola del servidor.
 */
export async function logError(
  source: ErrorSource,
  error: unknown,
  opts: { path?: string | null; orgId?: string | null; context?: Record<string, unknown> } = {},
): Promise<void> {
  const report = normalizeError(error, opts.context);
  try {
    let path = opts.path ?? null;
    if (!path) {
      // Dentro de una acción o un render: la página desde la que vino
      try {
        const h = await headers();
        path = h.get("referer") ?? h.get("next-url");
      } catch {
        path = null;
      }
    }
    const supabase = await createClient();
    const { error: rpcError } = await supabase.rpc("log_error", {
      p_source: source,
      p_message: report.message,
      p_digest: report.digest,
      p_stack: report.stack,
      p_path: path,
      p_context: report.context,
      p_org_id: opts.orgId ?? null,
    });
    if (rpcError) console.error("[error_logs] no se pudo registrar:", rpcError.message, report.message);
  } catch (e) {
    console.error("[error_logs] no se pudo registrar:", e, report.message);
  }
}

/**
 * Para las acciones: el mensaje para el usuario de un error de la base. Las reglas de
 * negocio conocidas no son fallos; lo desconocido se registra (y el usuario ve un
 * mensaje genérico).
 */
export async function reportDbError(error: { message?: string; code?: string } | null): Promise<string> {
  const known = knownDbError(error);
  if (known) return known;
  await logError("action", error ?? new Error("Error de base sin detalle"));
  return UNEXPECTED_ERROR;
}

/**
 * Para datos que pueden fallar sin tumbar la página (contadores del menú, por ejemplo):
 * devuelve un valor por defecto, pero deja el fallo registrado.
 */
export function fallback<T>(value: T, what: string) {
  return async (error: unknown): Promise<T> => {
    await logError("data", error, { context: { what } });
    return value;
  };
}
