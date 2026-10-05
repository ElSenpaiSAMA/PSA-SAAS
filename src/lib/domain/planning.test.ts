import { describe, expect, it } from "vitest";
import { weeksOfMonth } from "./periods";
import { dailyHours, loadLevel, weekCapacity, weeklyLoad, workingDays } from "./planning";

describe("planificación", () => {
  it("cuenta días hábiles", () => {
    expect(workingDays("2026-10-02", "2026-10-06")).toEqual(["2026-10-02", "2026-10-05", "2026-10-06"]);
    expect(workingDays("2026-10-03", "2026-10-04")).toEqual(["2026-10-04"]); // finde: se planifica igual
  });

  it("reparte las horas parejas entre los días hábiles", () => {
    const hours = dailyHours({ membership_id: "a", estimated_hours: 10, start_date: "2026-10-05", due_date: "2026-10-09" });
    expect([...hours.values()]).toEqual([2, 2, 2, 2, 2]);
  });

  it("acumula carga por persona y semana", () => {
    const weeks = weeksOfMonth("2026-10-01");
    const load = weeklyLoad(
      [
        { membership_id: "ana", estimated_hours: 10, start_date: "2026-10-05", due_date: "2026-10-09" },
        { membership_id: "ana", estimated_hours: 20, start_date: "2026-10-05", due_date: "2026-10-16" },
        { membership_id: "diego", estimated_hours: 8, start_date: "2026-10-30", due_date: "2026-11-02" },
      ],
      weeks,
    );
    expect(load.get("ana")).toEqual([0, 20, 10, 0, 0]);
    // 30/10 (vie) en la semana 5; 2/11 cae fuera de las semanas del mes
    expect(load.get("diego")).toEqual([0, 0, 0, 0, 4]);
  });

  it("descuenta de la capacidad los días fuera del mes", () => {
    const [first] = weeksOfMonth("2026-10-01"); // lun 28/9 – dom 4/10
    expect(weekCapacity(40, first, "2026-10-01", "2026-10-31")).toBe(16); // jue y vie
  });

  it("clasifica el nivel de carga", () => {
    expect(loadLevel(0, 40)).toBe("free");
    expect(loadLevel(10, 40)).toBe("low");
    expect(loadLevel(30, 40)).toBe("healthy");
    expect(loadLevel(36, 40)).toBe("high");
    expect(loadLevel(45, 40)).toBe("over");
  });
});
