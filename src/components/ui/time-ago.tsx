"use client";

import { relativeTime } from "@/lib/domain/audit";
import { useNow } from "@/lib/use-now";

/** "hace 2 horas" con la fecha completa al pasar el mouse. Se calcula en el cliente (zona horaria del navegador). */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const now = useNow();
  return (
    <time
      dateTime={iso}
      className={className}
      title={now === null ? undefined : new Date(iso).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}
      suppressHydrationWarning
    >
      {now === null ? " " : relativeTime(iso, now)}
    </time>
  );
}
