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
  "audit.view",
  "platform.manage",
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
  superadmin: "Todo: la empresa y la plataforma (errores y estructura de permisos)",
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
  // El desarrollador: todo, incluida la plataforma (errores y estructura de permisos)
  superadmin: PERMISSIONS,
  // El CEO: toda la empresa, pero no la configuración de la plataforma
  owner: PERMISSIONS.filter((p) => p !== "platform.manage"),
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

// ── Funciones de empresa que se asignan a ramas y departamentos ──
/** Lo que una rama (su director) o un departamento (su responsable) gestiona para toda la empresa. */
export const FUNCTION_PERMISSIONS: { key: Permission; label: string; hint: string }[] = [
  { key: "employees.manage", label: "Personas", hint: "Invitar, editar niveles y departamentos, ajustes de la empresa" },
  { key: "people.sensitive", label: "Fichas y datos sensibles", hint: "DNI, contrato, sueldo, IBAN" },
  { key: "departments.manage", label: "Departamentos y ramas", hint: "Crearlos y asignar responsables" },
  { key: "holidays.manage", label: "Festivos", hint: "El calendario laboral" },
  { key: "projects.manage", label: "Proyectos de toda la empresa", hint: "Crear y gestionar cualquier proyecto" },
  { key: "tasks.manage_all", label: "Tareas de cualquier proyecto", hint: "Crear, asignar y editar" },
  { key: "billing.manage", label: "Facturación", hint: "Tarifas y facturar OT" },
  { key: "contact.manage", label: "Mensajes web", hint: "Consultas del formulario de contacto" },
  { key: "automations.manage", label: "Automatizaciones", hint: "Reglas que trabajan solas" },
  { key: "forum.moderate", label: "Moderar el foro", hint: "Fijar, cerrar y borrar hilos" },
  { key: "audit.view", label: "Auditoría", hint: "Historial de cambios de la empresa" },
];
