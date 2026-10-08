import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// URL legibles: /app/projects/climatizacion-princess-v58 en lugar del id. La base fija el
// slug (migración 0027). Un enlace viejo con el id (avisos guardados, marcadores) redirige
// a la URL legible.

const SECTIONS = {
  projects: "projects",
  work_orders: "work-orders",
  memberships: "staff",
} as const;

type SluggedTable = keyof typeof SECTIONS;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ruta legible de un registro: /app/staff/ana-torres */
export function slugPath(table: SluggedTable, slug: string) {
  return `/app/${SECTIONS[table]}/${slug}`;
}

/**
 * Devuelve el id del registro de la URL. Con un id, redirige a la URL legible (conservando
 * la query); con un slug que no existe (o que la persona no puede ver, por RLS), 404.
 */
export async function resolveSlug(table: SluggedTable, orgId: string, param: string, query?: Record<string, string | string[] | undefined>) {
  const supabase = await createClient();
  const key = decodeURIComponent(param);

  if (UUID.test(key)) {
    const { data, error } = await supabase.from(table).select("slug").eq("id", key).eq("org_id", orgId).maybeSingle();
    // Sin la columna slug (migración pendiente) se sigue usando el id
    if (error || !data?.slug) return key;
    permanentRedirect(slugPath(table, data.slug) + toQuery(query));
  }

  const { data } = await supabase.from(table).select("id").eq("org_id", orgId).eq("slug", key).maybeSingle();
  if (!data) notFound();
  return data.id;
}

function toQuery(query?: Record<string, string | string[] | undefined>) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    for (const value of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, value);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
