// URL legibles (ver src/lib/data/slugs.ts y la migración 0027).

/**
 * Lo que va en la URL de un registro: su slug o, si la base todavía no lo tiene (migración
 * 0027 sin aplicar), su id, que también funciona.
 */
export function urlKey(row: { id: string; slug?: string | null }) {
  return row.slug || row.id;
}
