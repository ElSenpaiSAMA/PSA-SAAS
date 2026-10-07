import { describe, expect, it } from "vitest";
import { canManageProject, canViewProject, creatableDepartments, projectTeam, type ProjectAccessContext } from "./projects";

const eng = { id: "p-eng", department_id: "d-eng" };
const people = { id: "p-people", department_id: "d-people" };
const loose = { id: "p-loose", department_id: null };

const ctx = (partial: Partial<ProjectAccessContext>): ProjectAccessContext => ({
  managesAllProjects: false,
  headOfDepartmentId: null,
  memberOf: new Set(),
  ...partial,
});

describe("acceso a proyectos", () => {
  it("admin/owner ve y gestiona todo", () => {
    const admin = ctx({ managesAllProjects: true });
    for (const p of [eng, people, loose]) {
      expect(canViewProject(admin, p)).toBe(true);
      expect(canManageProject(admin, p)).toBe(true);
    }
  });

  it("el responsable ve y gestiona solo los proyectos de su departamento", () => {
    const head = ctx({ headOfDepartmentId: "d-eng" });
    expect(canManageProject(head, eng)).toBe(true);
    expect(canViewProject(head, people)).toBe(false);
    expect(canViewProject(head, loose)).toBe(false);
  });

  it("un miembro ve el proyecto pero no lo gestiona", () => {
    const member = ctx({ memberOf: new Set(["p-people"]) });
    expect(canViewProject(member, people)).toBe(true);
    expect(canManageProject(member, people)).toBe(false);
    expect(canViewProject(member, eng)).toBe(false);
  });

  it("solo se crean proyectos en departamentos propios (o en todos si es admin)", () => {
    const departments = [{ id: "d-eng" }, { id: "d-people" }];
    expect(creatableDepartments(ctx({ headOfDepartmentId: "d-eng" }), departments)).toEqual([{ id: "d-eng" }]);
    expect(creatableDepartments(ctx({ managesAllProjects: true }), departments)).toHaveLength(2);
    expect(creatableDepartments(ctx({}), departments)).toEqual([]);
  });
});

describe("projectTeam", () => {
  const people = [
    { id: "ana", name: "Ana", avatar: null, position: "Técnica", departmentId: "taller" },
    { id: "diego", name: "Diego", avatar: null, position: "Técnico", departmentId: "taller" },
    { id: "pol", name: "Pol", avatar: null, position: "Comercial", departmentId: "oficina" },
    { id: "ivan", name: "Iván", avatar: null, position: "Administrativo", departmentId: "admin" },
    { id: "lucia", name: "Lucía", avatar: null, position: "Aprendiz", departmentId: "taller" },
  ];
  const { members, candidates } = projectTeam(
    people,
    [
      { membership_id: "pol", role: "observer" },
      { membership_id: "ana", role: "member" },
      { membership_id: "diego", role: "lead" },
    ],
    { department_id: "taller" },
    "ana",
  );

  it("el equipo va ordenado: responsables, miembros y observadores", () => {
    expect(members.map((m) => [m.name, m.role])).toEqual([
      ["Diego", "lead"],
      ["Ana", "member"],
      ["Pol", "observer"],
    ]);
    expect(members.find((m) => m.isMe)?.name).toBe("Ana");
  });

  it("para invitar, primero la gente del departamento del proyecto", () => {
    expect(candidates.map((c) => [c.name, c.sameDepartment])).toEqual([
      ["Lucía", true],
      ["Iván", false],
    ]);
  });
});
