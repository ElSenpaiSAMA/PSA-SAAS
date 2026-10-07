import type { Instrumentation } from "next";

/**
 * Errores del servidor (render de Server Components, Route Handlers, Server Actions y
 * proxy) que nadie capturó: se registran en public.error_logs. Acá no hay sesión, así que
 * se usa el cliente anónimo (log_error lo acepta) y se guarda la ruta y el contexto.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const { normalizeError, isNoise } = await import("@/lib/errors/normalize");
    const report = normalizeError(err, {
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    });
    if (isNoise(report.message)) return;
    await fetch(`${url}/rest/v1/rpc/log_error`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        p_source: context.routeType === "action" ? "action" : "server",
        p_message: report.message,
        p_digest: report.digest,
        p_stack: report.stack,
        p_path: request.path,
        p_context: report.context,
      }),
    });
  } catch (e) {
    console.error("[error_logs] no se pudo registrar el error del servidor:", e);
  }
};
