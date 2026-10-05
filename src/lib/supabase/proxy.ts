import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

const PROTECTED_PREFIXES = ["/app", "/select-organization"];
const AUTH_PAGES = ["/login", "/signup"];

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
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getUser();
    signedIn = !!data.user;
  } catch {
    signedIn = false;
  }

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

  return response;
}

// Conserva las cookies de sesión refrescadas al redirigir
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
