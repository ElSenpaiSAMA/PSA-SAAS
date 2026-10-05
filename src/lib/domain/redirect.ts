/**
 * Solo acepta rutas internas de la app. Rechaza URLs absolutas, protocol-relative (`//evil.com`)
 * y variantes con backslash que algunos navegadores normalizan a `//`.
 */
export function safeNextPath(next: unknown, fallback = "/select-organization"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
