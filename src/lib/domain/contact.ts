import type { ContactStatus } from "@/lib/supabase/database.types";

export const CONTACT_STATUSES = ["new", "in_progress", "closed"] as const satisfies readonly ContactStatus[];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  new: "Nuevo",
  in_progress: "En curso",
  closed: "Cerrado",
};

/** Pestañas de la bandeja: los tres estados y "todos". */
export type ContactFilter = ContactStatus | "all";

export const CONTACT_FILTERS: { key: ContactFilter; label: string }[] = [
  { key: "new", label: "Nuevos" },
  { key: "in_progress", label: "En curso" },
  { key: "closed", label: "Cerrados" },
  { key: "all", label: "Todos" },
];

export function isContactFilter(value: unknown): value is ContactFilter {
  return value === "all" || (CONTACT_STATUSES as readonly unknown[]).includes(value);
}

/** Cuántos mensajes hay en cada pestaña. */
export function countByFilter(messages: { status: ContactStatus }[]): Record<ContactFilter, number> {
  const counts: Record<ContactFilter, number> = { new: 0, in_progress: 0, closed: 0, all: messages.length };
  for (const m of messages) counts[m.status] += 1;
  return counts;
}

/**
 * Pestaña por defecto: la de mensajes nuevos si hay alguno; si no, todos
 * (así la bandeja nunca abre vacía cuando hay historial).
 */
export function defaultFilter(counts: Record<ContactFilter, number>): ContactFilter {
  return counts.new > 0 ? "new" : "all";
}

/** Enlace para responder desde el cliente de correo, con asunto y la consulta citada. */
export function replyMailto(m: { name: string; email: string; service: string; message: string }, company: string): string {
  const subject = `Re: ${m.service} · ${company}`;
  const quoted = m.message
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const body = `Hola ${m.name.split(" ")[0]},\n\n\n\n${quoted}`;
  return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
