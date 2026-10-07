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
