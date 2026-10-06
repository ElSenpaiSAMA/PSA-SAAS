/** Páginas de la web pública de la empresa (siempre en tema claro, sin selector de tema). */
const PUBLIC_SITE_PATHS = ["/", "/contacto"];

export function isPublicSitePath(pathname: string | null): boolean {
  if (!pathname) return false;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_SITE_PATHS.includes(clean);
}
