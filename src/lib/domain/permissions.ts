// Estructura de la empresa (ver 0022_org_structure.sql). Dos estructuras conviven:
//   · la organización (nivel de cada persona + rama/departamento) → gestiona PERSONAS
//   · el trabajo (rol en cada proyecto) → gestiona PROYECTOS y OT
// Los permisos efectivos los calcula la base (my_permissions); acá están los niveles,
// los nombres y los permisos BASE de cada nivel, para la interfaz.

/** De mayor a menor nivel. */
export const ROLES = ["superadmin", "owner", "director", "manager", "coordinator", "employee", "intern", "external"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "employees.manage",
  "projects.manage",
  "tasks.manage_all",
  "time.view_team",
  "vacations.approve",
  "departments.manage",
  "billing.manage",
  "holidays.manage",
  "people.sensitive",
  "automations.manage",
  "forum.moderate",
  "contact.manage",
  "planning.view",
  "people.view",
  "workspace.access",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LEVEL: Record<Role, number> = {
  superadmin: 8,
  owner: 7,
  director: 6,
  manager: 5,
  coordinator: 4,
  employee: 3,
  intern: 2,
  external: 1,
};

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadmin",
  owner: "CEO",
  director: "Dirección de rama",
  manager: "Responsable de departamento",
  coordinator: "Coordinador / Encargado",
  employee: "Empleado",
  intern: "Aprendiz",
  external: "Externo",
};

/** Qué abarca cada nivel, en una línea (para los selectores y la ayuda). */
export const ROLE_SCOPE: Record<Role, string> = {
  superadmin: "La plataforma: todo, oculto en la empresa",
  owner: "Toda la empresa",
  director: "Las personas y los módulos de su rama",
  manager: "Su departamento",
  coordinator: "El grupo a su cargo",
  employee: "Lo suyo y los proyectos donde está",
  intern: "Lo suyo; imputa solo en sus tareas",
  external: "Solo lo que le asignan; sin foro ni directorio",
};

// Espejo de public.role_permissions (permisos BASE de cada nivel). La rama que dirige
// o el departamento que encabeza cada persona suman los de su función.
const BASE: Record<Role, readonly Permission[]> = {
  superadmin: PERMISSIONS,
  owner: PERMISSIONS,
  director: ["time.view_team", "vacations.approve", "planning.view", "people.view", "workspace.access"],
  manager: ["time.view_team", "vacations.approve", "planning.view", "people.view", "workspace.access"],
  coordinator: ["time.view_team", "planning.view", "people.view", "workspace.access"],
  employee: ["workspace.access"],
  intern: ["workspace.access"],
  external: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return BASE[role].includes(permission);
}

export function outranks(a: Role, b: Role): boolean {
  return ROLE_LEVEL[a] > ROLE_LEVEL[b];
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** Niveles que alguien puede asignar: por debajo del suyo (el CEO y el superadmin, todos menos CEO y superadmin). */
export function assignableRoles(myRole: Role): Role[] {
  const top = myRole === "owner" || myRole === "superadmin";
  return ROLES.filter((r) => r !== "owner" && r !== "superadmin" && (top || outranks(myRole, r)));
}

// ── Rol en cada proyecto (estructura del trabajo) ─────────────
export const PROJECT_ROLES = ["lead", "member", "observer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  lead: "Responsable",
  member: "Miembro",
  observer: "Observador",
};

export const PROJECT_ROLE_HINT: Record<ProjectRole, string> = {
  lead: "Gestiona el proyecto y sus OT, e invita gente",
  member: "Ve el proyecto y sus OT, e imputa horas",
  observer: "Solo mira",
};

export function isProjectRole(value: unknown): value is ProjectRole {
  return (PROJECT_ROLES as readonly unknown[]).includes(value);
}
