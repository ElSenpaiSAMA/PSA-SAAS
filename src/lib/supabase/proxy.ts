import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

const PROTECTED_PREFIXES = ["/app", "/select-organization"];
const AUTH_PAGES = ["/login", "/signup"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Empresa activa: las URL de la intranet no llevan su id (/app/inbox, no /app/<uuid>/inbox) */
export const ORG_COOKIE = "org";
const ORG_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

/**
 * Refresca la sesión de Supabase en cada request y hace los redirects optimistas.
 * La autorización real (membership en la org) se valida en el layout de /app/[orgId] y en RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // No ejecutar código entre createServerClient y getUser: es lo que refresca el token.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  const signedIn = !!userId;

  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!signedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(url, response);
  }

  if (signedIn && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/select-organization";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  if (userId && pathname.startsWith("/app/")) return routeToOrg(request, response, supabase, userId);

  return response;
}

/**
 * URL limpias de la intranet: `/app/inbox` se sirve internamente desde `/app/<empresa>/inbox`,
 * con la empresa de la cookie. Un enlace con el id (avisos guardados, marcadores, cambio de
 * empresa) recuerda esa empresa y redirige a la URL limpia. La pertenencia real a la empresa
 * la siguen validando el layout de /app/[orgId] y RLS.
 */
async function routeToOrg(
  request: NextRequest,
  response: NextResponse,
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
) {
  const [first, ...rest] = request.nextUrl.pathname.slice("/app/".length).split("/");

  if (UUID.test(first)) {
    // Solo se recuerda una empresa propia; una ajena sigue su camino y el layout responde 404
    const { data: member } = await supabase.from("memberships").select("id").eq("user_id", userId).eq("org_id", first).maybeSingle();
    if (!member) return response;
    const url = request.nextUrl.clone();
    url.pathname = `/app/${rest.join("/") || "dashboard"}`;
    const redirect = redirectWithCookies(url, response);
    redirect.cookies.set(ORG_COOKIE, first.toLowerCase(), ORG_COOKIE_OPTIONS);
    return redirect;
  }

  let org = request.cookies.get(ORG_COOKIE)?.value ?? null;
  const remembered = !!org && UUID.test(org);
  if (!remembered) {
    const { data } = await supabase.from("memberships").select("org_id").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
    if (!data) {
      const url = request.nextUrl.clone();
      url.pathname = "/select-organization";
      url.search = "";
      return redirectWithCookies(url, response);
    }
    org = data.org_id;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/app/${org}/${[first, ...rest].join("/")}`;
  const rewrite = NextResponse.rewrite(url, { request: { headers: request.headers } });
  for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
  if (!remembered && org) rewrite.cookies.set(ORG_COOKIE, org, ORG_COOKIE_OPTIONS);
  return rewrite;
}

// Conserva las cookies de sesión refrescadas al redirigir
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
