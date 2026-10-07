"use client";

import { ErrorScreen } from "@/components/error-screen";
import "./globals.css";

// Si falla el layout raíz no hay nada en pie: esta pantalla trae su propio <html>
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <ErrorScreen error={error} retry={retry} kind="global-boundary" />
      </body>
    </html>
  );
}
