import { describe, expect, it } from "vitest";
import { capList, extractJson, parseAllocation, toBlocks, toQuarter } from "./ai";

describe("extractJson", () => {
  it("lee JSON plano, dentro de ```json``` o con texto alrededor", () => {
    expect(extractJson('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(extractJson('Acá va:\n```json\n{"items":[1,2]}\n```\nListo')).toEqual({ items: [1, 2] });
    expect(extractJson('Propuesta: {"x": true} fin')).toEqual({ x: true });
  });

  it("devuelve null si no hay JSON válido", () => {
    expect(extractJson("no hay nada")).toBeNull();
    expect(extractJson("{roto")).toBeNull();
  });
});

describe("parseAllocation", () => {
  const tasks = [
    { id: "t1", title: "Webhooks" },
    { id: "t2", title: "Conciliación" },
  ];

  it("descarta tareas inventadas, repetidas o con horas inválidas, y redondea a cuartos", () => {
    const items = parseAllocation(
      [
        { taskId: "t1", hours: 3.1, reason: "Avanzaste con los reintentos" },
        { taskId: "t1", hours: 2 },
        { taskId: "inventada", hours: 4 },
        { task_id: "t2", hours: "2" },
        { taskId: "t2", hours: -1 },
      ],
      tasks,
      8,
    );
    expect(items).toEqual([
      { taskId: "t1", title: "Webhooks", hours: 3, reason: "Avanzaste con los reintentos" },
      { taskId: "t2", title: "Conciliación", hours: 2, reason: "" },
    ]);
  });

  it("nunca reparte más de lo trabajado: si se pasa, escala hacia abajo", () => {
    const items = parseAllocation({ items: [{ taskId: "t1", hours: 6 }, { taskId: "t2", hours: 6 }] }, tasks, 8);
    expect(items.map((i) => i.hours)).toEqual([4, 4]);
  });

  it("ante basura, no propone nada", () => {
    expect(parseAllocation(null, tasks, 8)).toEqual([]);
    expect(parseAllocation("texto", tasks, 8)).toEqual([]);
  });
});

describe("utilidades", () => {
  it("redondea a cuartos de hora y recorta listas", () => {
    expect(toQuarter(1.13)).toBe(1.25);
    expect(capList([1, 2, 3, 4], 2)).toEqual({ items: [1, 2], omitted: 2 });
  });

  it("convierte la respuesta en párrafos y listas", () => {
    expect(toBlocks("Hola **equipo**.\n\n- Ana: 5 días\n- Diego: 2 días\n\nNada más.")).toEqual([
      { type: "p", text: "Hola equipo." },
      { type: "ul", items: ["Ana: 5 días", "Diego: 2 días"] },
      { type: "p", text: "Nada más." },
    ]);
  });
});
