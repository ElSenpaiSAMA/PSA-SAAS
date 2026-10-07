"use client";

import { ErrorScreen } from "@/components/error-screen";

// Un fallo dentro de una sección de la intranet: el marco (menú y barra) sigue en pie
export default function IntranetError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
