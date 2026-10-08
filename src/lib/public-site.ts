/** Páginas públicas de la empresa: la web y la entrada a la intranet (siempre en tema claro, sin selector). */
const PUBLIC_SITE_PATHS = ["/", "/contacto", "/electromotor", "/diplonautic", "/login", "/signup", "/activar-cuenta"];

export function isPublicSitePath(pathname: string | null): boolean {
  if (!pathname) return false;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_SITE_PATHS.includes(clean);
}
