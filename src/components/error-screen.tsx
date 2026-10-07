"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/errors/report-client";

/**
 * Pantalla de "algo falló": la usan los error.tsx. Reporta el error al registro una vez
 * y muestra el código para poder buscarlo en "Errores".
 */
export function ErrorScreen({
  error,
  retry,
  kind = "boundary",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  kind?: "boundary" | "global-boundary";
}) {
  useEffect(() => {
    // Con digest, el error vino del servidor y ya lo registró instrumentation.ts
    if (error.digest) return;
    void reportClientError({
      kind,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      path: window.location.pathname + window.location.search,
    }).catch(() => {});
  }, [error, kind]);

  return (
    <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-warning/15 text-warning">
        <TriangleAlert className="size-7" strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Algo falló al cargar esta pantalla</h1>
      <p className="mt-2 max-w-sm text-[14px] text-muted-foreground">
        Ya quedó registrado para revisarlo. Probá de nuevo; si sigue fallando, avisá indicando este código.
      </p>
      {error.digest ? <p className="mt-3 rounded-lg bg-muted px-2.5 py-1 font-mono text-[12px] text-muted-foreground">{error.digest}</p> : null}
      <Button className="mt-6" onClick={() => retry()}>
        <RotateCcw className="size-4" /> Probar de nuevo
      </Button>
    </div>
  );
}
