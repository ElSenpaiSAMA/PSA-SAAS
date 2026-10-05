import { describe, expect, it } from "vitest";
import { displayName, initials, reportsOf, supervisedIds, wouldCreateCycle } from "./hierarchy";

//      ceo
//     /    \
//   lead   ops
//   /  \
//  ana diego
const org = [
  { id: "ceo", manager_id: null },
  { id: "ops", manager_id: "ceo" },
  { id: "lead", manager_id: "ceo" },
  { id: "ana", manager_id: "lead" },
  { id: "diego", manager_id: "lead" },
];

describe("reportsOf", () => {
  it("incluye reportes directos e indirectos", () => {
    expect(reportsOf(org, "ceo")).toEqual(new Set(["ops", "lead", "ana", "diego"]));
    expect(reportsOf(org, "lead")).toEqual(new Set(["ana", "diego"]));
  });

  it("un empleado sin reportes no supervisa a nadie", () => {
    expect(reportsOf(org, "ana").size).toBe(0);
  });

  it("no entra en bucle con datos cíclicos", () => {
    const cyclic = [
      { id: "a", manager_id: "b" },
      { id: "b", manager_id: "a" },
    ];
    expect(reportsOf(cyclic, "a")).toEqual(new Set(["b"]));
  });
});

describe("supervisedIds", () => {
  it("admin ve toda la org menos a sí mismo", () => {
    expect(supervisedIds(org, "ops", true)).toEqual(new Set(["ceo", "lead", "ana", "diego"]));
  });

  it("manager ve solo su línea", () => {
    expect(supervisedIds(org, "lead", false)).toEqual(new Set(["ana", "diego"]));
  });
});

describe("wouldCreateCycle", () => {
  it("detecta asignar como manager a alguien de tu propia línea", () => {
    expect(wouldCreateCycle(org, "lead", "ana")).toBe(true);
    expect(wouldCreateCycle(org, "lead", "lead")).toBe(true);
    expect(wouldCreateCycle(org, "ana", "ops")).toBe(false);
    expect(wouldCreateCycle(org, "ana", null)).toBe(false);
  });
});

describe("displayName / initials", () => {
  it("usa nombre, luego email, luego fallback", () => {
    expect(displayName({ full_name: "Ana Torres", email: "a@x.com" })).toBe("Ana Torres");
    expect(displayName({ full_name: null, email: "a@x.com" })).toBe("a@x.com");
    expect(displayName(null)).toBe("Sin nombre");
  });

  it("toma hasta dos iniciales", () => {
    expect(initials("Ana María Torres")).toBe("AM");
    expect(initials("diego")).toBe("D");
  });
});
