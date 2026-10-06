import { describe, expect, it } from "vitest";
import {
  changedInRange,
  diffVersions,
  formatFieldValue,
  maskIban,
  recordAt,
  recordTimeline,
  seniorityYears,
  upcomingVersions,
  type RecordVersion,
} from "./employee-records";

const base = {
  national_id: "34567890V",
  birth_date: "1999-01-20",
  phone: "+34 600 333 444",
  personal_email: "ana@correo.test",
  address: "Calle Sol 5, Valencia",
  emergency_contact: null,
  hire_date: "2024-02-05",
  contract_type: "practicas",
  salary_annual: 18000,
  iban: "ES12 0049 1500 0512 3456 7892",
  notes: "Prácticas",
};

const v = (id: string, effective_from: string, patch: Partial<typeof base> = {}): RecordVersion => ({
  id,
  effective_from,
  created_at: `${effective_from}T10:00:00Z`,
  ...base,
  ...patch,
});

const versions = [
  v("alta", "2024-02-05"),
  v("indefinida", "2024-08-05", { contract_type: "indefinido", salary_annual: 34000, notes: "Pasa a indefinida" }),
  v("mudanza", "2026-09-15", { contract_type: "indefinido", salary_annual: "34000.00" as unknown as number, address: "Calle Luna 12, Madrid", phone: "+34 611 333 444" }),
  v("subida", "2026-12-01", { contract_type: "indefinido", salary_annual: 38000, address: "Calle Luna 12, Madrid", phone: "+34 611 333 444" }),
];

describe("ficha de empleado versionada", () => {
  it("devuelve la versión vigente a una fecha", () => {
    expect(recordAt(versions, "2024-01-01")).toBeNull();
    expect(recordAt(versions, "2024-05-10")?.id).toBe("alta");
    expect(recordAt(versions, "2024-08-05")?.id).toBe("indefinida");
    expect(recordAt(versions, "2026-10-06")?.id).toBe("mudanza");
  });

  it("separa los cambios programados a futuro", () => {
    expect(upcomingVersions(versions, "2026-10-06").map((x) => x.id)).toEqual(["subida"]);
  });

  it("detecta qué cambió entre versiones, sin falsos cambios por formato del salario", () => {
    expect(diffVersions(versions[1], versions[2]).map((c) => c.field)).toEqual(["phone", "address"]);
    expect(diffVersions(versions[0], versions[1])).toEqual([
      { field: "contract_type", from: "practicas", to: "indefinido" },
      { field: "salary_annual", from: 18000, to: 34000 },
    ]);
  });

  it("arma el historial del más reciente al más antiguo", () => {
    const t = recordTimeline(versions);
    expect(t.map((e) => e.version.id)).toEqual(["subida", "mudanza", "indefinida", "alta"]);
    expect(t[3].isFirst).toBe(true);
    expect(t[0].changes).toEqual([{ field: "salary_annual", from: 34000, to: 38000 }]);
  });

  it("marca los campos que cambiaron dentro de un mes", () => {
    expect([...changedInRange(versions, "2026-09-01", "2026-09-30")].sort()).toEqual(["address", "phone"]);
    expect(changedInRange(versions, "2024-02-01", "2024-02-29").size).toBe(0); // el alta no es un "cambio"
  });

  it("calcula antigüedad y enmascara el IBAN", () => {
    expect(seniorityYears("2024-02-05", "2026-02-04")).toBe(1);
    expect(seniorityYears("2024-02-05", "2026-02-05")).toBe(2);
    expect(seniorityYears("2027-01-01", "2026-02-05")).toBeNull();
    expect(maskIban("ES12 0049 1500 0512 3456 7892")).toBe("ES12 •••• •••• 7892");
  });

  it("formatea valores para mostrar", () => {
    expect(formatFieldValue("contract_type", "practicas")).toBe("Prácticas");
    expect(formatFieldValue("salary_annual", 34000)).toMatch(/34\.?000\s?€/);
    expect(formatFieldValue("phone", null)).toBe("—");
  });
});
