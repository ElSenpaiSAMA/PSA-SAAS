// Espejo en la UI de can_view_project / can_manage_project (la base es la fuente de verdad).

export interface ProjectAccessContext {
  /** projects.manage: owner/admin */
  managesAllProjects: boolean;
  /** Departamento que encabeza el usuario, si alguno */
  headOfDepartmentId: string | null;
  /** Proyectos donde el usuario es miembro */
  memberOf: ReadonlySet<string>;
}

export interface ProjectLike {
  id: string;
  department_id: string | null;
}

export function canManageProject(ctx: ProjectAccessContext, project: ProjectLike): boolean {
  if (ctx.managesAllProjects) return true;
  return project.department_id !== null && project.department_id === ctx.headOfDepartmentId;
}

export function canViewProject(ctx: ProjectAccessContext, project: ProjectLike): boolean {
  return canManageProject(ctx, project) || ctx.memberOf.has(project.id);
}

/** Departamentos en los que el usuario puede crear proyectos. */
export function creatableDepartments<T extends { id: string }>(ctx: ProjectAccessContext, departments: readonly T[]): T[] {
  if (ctx.managesAllProjects) return [...departments];
  return departments.filter((d) => d.id === ctx.headOfDepartmentId);
}

// ── Equipo de un proyecto (estructura del trabajo) ─────────────

export type TeamRole = "lead" | "member" | "observer";

export interface TeamPerson {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  departmentId: string | null;
}

const ROLE_ORDER: Record<TeamRole, number> = { lead: 0, member: 1, observer: 2 };

/**
 * Quiénes están en el proyecto (responsables primero) y a quién se puede invitar
 * (primero las personas del departamento del proyecto).
 */
export function projectTeam(
  people: readonly TeamPerson[],
  projectMembers: readonly { membership_id: string; role: TeamRole }[],
  project: { department_id: string | null },
  meId: string,
) {
  const roleOf = new Map(projectMembers.map((m) => [m.membership_id, m.role]));
  const members = people
    .filter((p) => roleOf.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, position: p.position, role: roleOf.get(p.id)!, isMe: p.id === meId }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, "es"));
  const candidates = people
    .filter((p) => !roleOf.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, sameDepartment: !!project.department_id && p.departmentId === project.department_id }))
    .sort((a, b) => Number(b.sameDepartment) - Number(a.sameDepartment) || a.name.localeCompare(b.name, "es"));
  return { members, candidates };
}
