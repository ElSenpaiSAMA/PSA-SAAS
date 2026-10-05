export interface Node {
  id: string;
  manager_id: string | null;
}

/** IDs de toda la línea de reporte (directos e indirectos) bajo `managerId`. */
export function reportsOf(nodes: readonly Node[], managerId: string): Set<string> {
  const result = new Set<string>();
  const queue = [managerId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const n of nodes) {
      if (n.manager_id === current && !result.has(n.id) && n.id !== managerId) {
        result.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return result;
}

/** Personas que el usuario puede supervisar: toda la org si es admin, si no su línea de reporte. */
export function supervisedIds(nodes: readonly Node[], me: string, seesWholeOrg: boolean): Set<string> {
  if (seesWholeOrg) return new Set(nodes.map((n) => n.id).filter((id) => id !== me));
  return reportsOf(nodes, me);
}

/** Evita ciclos: `candidateManager` no puede estar en la línea de reporte de `memberId`. */
export function wouldCreateCycle(nodes: readonly Node[], memberId: string, candidateManager: string | null): boolean {
  if (candidateManager === null) return false;
  if (candidateManager === memberId) return true;
  return reportsOf(nodes, memberId).has(candidateManager);
}

export function displayName(profile: { full_name: string | null; email: string | null } | null): string {
  return profile?.full_name || profile?.email || "Sin nombre";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
