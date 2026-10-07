// Registro de errores: convierte cualquier cosa lanzada en un reporte uniforme.
// Puro (sin servidor ni navegador) para usarlo en los dos lados y testearlo.

export type ErrorSource = "server" | "action" | "client" | "data";

export interface ErrorReport {
  message: string;
  digest: string | null;
  stack: string | null;
  context: Record<string, unknown>;
}

const MAX_MESSAGE = 1000;
const MAX_STACK = 8000;

/** Un error de Supabase/Postgres trae message, code, details y hint (no es un Error). */
function isPostgrestError(value: unknown): value is { message: string; code?: string; details?: string; hint?: string } {
  return typeof value === "object" && value !== null && "message" in value && typeof (value as { message: unknown }).message === "string";
}

export function normalizeError(error: unknown, context: Record<string, unknown> = {}): ErrorReport {
  const digest =
    typeof error === "object" && error !== null && "digest" in error && (error as { digest: unknown }).digest != null
      ? String((error as { digest: unknown }).digest)
      : null;

  if (error instanceof Error) {
    return {
      message: (error.message || error.name || "Error sin mensaje").slice(0, MAX_MESSAGE),
      digest,
      stack: error.stack ? error.stack.slice(0, MAX_STACK) : null,
      context: { ...context, name: error.name },
    };
  }
  if (isPostgrestError(error)) {
    const { message, code, details, hint } = error;
    return {
      message: message.slice(0, MAX_MESSAGE),
      digest,
      stack: null,
      context: { ...context, ...(code ? { code } : {}), ...(details ? { details } : {}), ...(hint ? { hint } : {}) },
    };
  }
  let text: string;
  try {
    text = typeof error === "string" ? error : JSON.stringify(error);
  } catch {
    text = String(error);
  }
  return { message: (text || "Error desconocido").slice(0, MAX_MESSAGE), digest, stack: null, context };
}

/**
 * Errores del navegador que no son fallos de la app (extensiones, cortes de red al
 * navegar, ResizeObserver): no vale la pena registrarlos.
 */
export function isNoise(message: string): boolean {
  return [
    /ResizeObserver loop/i,
    /^Script error\.?$/i,
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /NEXT_REDIRECT/,
    /NEXT_NOT_FOUND/,
    /AbortError/i,
  ].some((re) => re.test(message));
}
