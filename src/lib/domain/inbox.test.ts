import { describe, expect, it } from "vitest";
import { buildPending, type PendingInput } from "./inbox";

const empty: PendingInput = {
  orgId: "o1",
  today: "2026-10-06",
  toInvoice: [],
  managedWorkOrders: [],
  myTasks: [],
  openClockSince: null,
};

describe("bandeja de pendientes", () => {
  it("sin nada que hacer, la bandeja está vacía", () => {
    expect(buildPending(empty)).toEqual([]);
  });

  it("OT: cerrar las vencidas, aprobar los borradores que ya empezaron, ignorar el resto", () => {
    const items = buildPending({
      ...empty,
      managedWorkOrders: [
        { id: "w1", title: "Portal · Septiembre", status: "in_progress", period_start: "2026-09-01", period_end: "2026-09-30", project: "Portal" },
        { id: "w2", title: "API · Octubre", status: "draft", period_start: "2026-10-01", period_end: "2026-10-31", project: "API" },
        { id: "w3", title: "API · Noviembre", status: "draft", period_start: "2026-11-01", period_end: "2026-11-30", project: "API" },
        { id: "w4", title: "Portal · Octubre", status: "in_progress", period_start: "2026-10-01", period_end: "2026-10-31", project: "Portal" },
      ],
    });
    expect(items.map((i) => [i.kind, i.entityId])).toEqual([
      ["close_work_order", "w1"],
      ["approve_work_order", "w2"],
    ]);
  });

  it("tareas vencidas propias y fichaje olvidado de un día anterior", () => {
    const items = buildPending({
      ...empty,
      myTasks: [
        { id: "t1", title: "Informe", due_date: "2026-10-05", status: "in_progress", project_id: "p", project: "Portal" },
        { id: "t2", title: "Hecha", due_date: "2026-10-01", status: "done", project_id: "p", project: "Portal" },
        { id: "t3", title: "A tiempo", due_date: "2026-10-06", status: "todo", project_id: "p", project: "Portal" },
      ],
      openClockSince: "2026-10-05T08:00:00Z",
    });
    expect(items.map((i) => i.kind)).toEqual(["open_clock", "overdue_task"]);
    expect(items[1].detail).toBe("Portal · venció hace 1 día");
  });

  it("un fichaje abierto de hoy no es un pendiente", () => {
    expect(buildPending({ ...empty, openClockSince: "2026-10-06T08:00:00Z" })).toEqual([]);
  });

  it("lo urgente va primero y, dentro de cada grupo, lo más viejo", () => {
    const items = buildPending({
      ...empty,
      toInvoice: [
        { id: "i1", title: "OT reciente", period_end: "2026-09-30", project: "A" },
        { id: "i2", title: "OT vieja", period_end: "2026-08-31", project: "B" },
      ],
    });
    expect(items.map((i) => [i.entityId, i.urgent])).toEqual([
      ["i2", true],
      ["i1", false],
    ]);
  });
});
