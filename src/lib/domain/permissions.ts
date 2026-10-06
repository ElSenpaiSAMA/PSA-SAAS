export const ROLES = ["owner", "admin", "manager", "employee"] as const;
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
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LEVEL: Record<Role, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrador",
  manager: "Manager",
  employee: "Empleado",
};

// Espejo de public.role_permissions: la base es la fuente de verdad (RLS),
// esto solo decide qué mostrar en la UI.
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  manager: ["time.view_team", "vacations.approve"],
  employee: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function outranks(a: Role, b: Role): boolean {
  return ROLE_LEVEL[a] > ROLE_LEVEL[b];
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
