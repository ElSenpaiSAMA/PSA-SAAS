"use server";

import { logError } from "./server";

/**
 * El navegador reporta un error (pantalla de error, error no capturado o promesa rechazada).
 * La base limita tamaño y frecuencia, así que un bug en bucle no llena la tabla.
 */
export async function reportClientError(input: {
  message: string;
  stack?: string | null;
  digest?: string | null;
  path?: string | null;
  kind: "boundary" | "global-boundary" | "uncaught" | "unhandled-rejection";
}): Promise<void> {
  const message = String(input.message ?? "").slice(0, 1000);
  if (!message) return;
  const error = Object.assign(new Error(message), {
    stack: input.stack ? String(input.stack).slice(0, 8000) : undefined,
    digest: input.digest ?? undefined,
  });
  await logError("client", error, { path: input.path ?? null, context: { kind: input.kind } });
}
