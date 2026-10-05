import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/domain/redirect";
import { createClient } from "@/lib/supabase/server";

// Destino de los links de confirmación de email (flujo PKCE)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
