import { describe, expect, it } from "vitest";
import { hasPermission, isRole, outranks, PERMISSIONS } from "./permissions";

describe("hasPermission", () => {
  it("owner y admin tienen todos los permisos", () => {
    for (const p of PERMISSIONS) {
      expect(hasPermission("owner", p)).toBe(true);
      expect(hasPermission("admin", p)).toBe(true);
    }
  });

  it("manager solo ve al equipo y aprueba vacaciones", () => {
    expect(hasPermission("manager", "time.view_team")).toBe(true);
    expect(hasPermission("manager", "vacations.approve")).toBe(true);
    expect(hasPermission("manager", "employees.manage")).toBe(false);
    expect(hasPermission("manager", "projects.manage")).toBe(false);
  });

  it("employee no tiene permisos de gestión", () => {
    for (const p of PERMISSIONS) expect(hasPermission("employee", p)).toBe(false);
  });
});

describe("outranks", () => {
  it("respeta la jerarquía", () => {
    expect(outranks("owner", "admin")).toBe(true);
    expect(outranks("manager", "employee")).toBe(true);
    expect(outranks("employee", "manager")).toBe(false);
    expect(outranks("admin", "admin")).toBe(false);
  });
});

describe("isRole", () => {
  it("valida strings de rol", () => {
    expect(isRole("manager")).toBe(true);
    expect(isRole("superadmin")).toBe(false);
  });
});
