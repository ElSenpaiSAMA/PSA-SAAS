import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assignableRoles, hasPermission, isRole, outranks, PERMISSIONS, ROLE_LEVEL, ROLES } from "./permissions";

describe("niveles", () => {
  it("ROLES va de mayor a menor nivel", () => {
    const levels = ROLES.map((r) => ROLE_LEVEL[r]);
    expect(levels).toEqual([...levels].sort((a, b) => b - a));
  });

  it("coinciden con los de la base (migración 0022)", () => {
    const sql = readFileSync("supabase/migrations/0022_org_structure.sql", "utf8");
    for (const [role, level] of [
      ["superadmin", 8],
      ["director", 6],
      ["coordinator", 4],
      ["intern", 2],
      ["external", 1],
    ] as const) {
      expect(sql).toContain(`('${role}', `);
      expect(ROLE_LEVEL[role]).toBe(level);
    }
    expect(sql).toContain("name = 'CEO', level = 7 where id = 'owner'");
  });
});

describe("permisos base", () => {
  it("CEO y superadmin tienen todos", () => {
    for (const p of PERMISSIONS) {
      expect(hasPermission("owner", p)).toBe(true);
      expect(hasPermission("superadmin", p)).toBe(true);
    }
  });

  it("un empleado y una aprendiz solo acceden al espacio común", () => {
    for (const role of ["employee", "intern"] as const) {
      expect(PERMISSIONS.filter((p) => hasPermission(role, p))).toEqual(["workspace.access"]);
    }
  });

  it("un externo no tiene ni el espacio común (foro, directorio, calendario)", () => {
    for (const p of PERMISSIONS) expect(hasPermission("external", p)).toBe(false);
  });

  it("los niveles con gente a cargo ven planificación y fichas, pero la gestión de personas viene de su rama", () => {
    for (const role of ["director", "manager", "coordinator"] as const) {
      expect(hasPermission(role, "planning.view")).toBe(true);
      expect(hasPermission(role, "employees.manage")).toBe(false);
    }
    expect(hasPermission("coordinator", "vacations.approve")).toBe(false);
  });
});

describe("outranks y assignableRoles", () => {
  it("respeta la jerarquía", () => {
    expect(outranks("owner", "director")).toBe(true);
    expect(outranks("coordinator", "employee")).toBe(true);
    expect(outranks("employee", "coordinator")).toBe(false);
    expect(outranks("director", "director")).toBe(false);
  });

  it("nadie asigna CEO ni superadmin; el resto, solo por debajo del propio nivel", () => {
    expect(assignableRoles("owner")).toEqual(["director", "manager", "coordinator", "employee", "intern", "external"]);
    expect(assignableRoles("director")).toEqual(["manager", "coordinator", "employee", "intern", "external"]);
    expect(assignableRoles("employee")).toEqual(["intern", "external"]);
  });
});

describe("isRole", () => {
  it("valida strings de rol", () => {
    expect(isRole("coordinator")).toBe(true);
    expect(isRole("admin")).toBe(false);
  });
});
