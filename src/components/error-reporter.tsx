"use client";

import { useEffect } from "react";
import { isNoise } from "@/lib/errors/normalize";
import { reportClientError } from "@/lib/errors/report-client";

/**
 * Escucha los errores del navegador que nadie capturó (excepciones y promesas rechazadas)
 * y los manda al registro de errores. Un mismo error se reporta una sola vez por visita.
 */
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const send = (kind: "uncaught" | "unhandled-rejection", error: unknown, fallbackMessage: string) => {
      const message = error instanceof Error ? error.message : fallbackMessage;
      if (!message || isNoise(message) || seen.has(message) || seen.size > 20) return;
      seen.add(message);
      void reportClientError({
        kind,
        message,
        stack: error instanceof Error ? error.stack : null,
        path: window.location.pathname + window.location.search,
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => send("uncaught", e.error, e.message);
    const onRejection = (e: PromiseRejectionEvent) => send("unhandled-rejection", e.reason, String(e.reason ?? ""));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
