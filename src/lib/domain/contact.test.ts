import { describe, expect, it } from "vitest";
import { countByFilter, defaultFilter, isContactFilter, replyMailto } from "./contact";

describe("countByFilter", () => {
  it("cuenta por estado y el total", () => {
    const counts = countByFilter([{ status: "new" }, { status: "new" }, { status: "closed" }]);
    expect(counts).toEqual({ new: 2, in_progress: 0, closed: 1, all: 3 });
  });
});

describe("defaultFilter", () => {
  it("abre en nuevos si hay alguno", () => {
    expect(defaultFilter({ new: 1, in_progress: 0, closed: 4, all: 5 })).toBe("new");
  });

  it("si no hay nuevos, muestra todos", () => {
    expect(defaultFilter({ new: 0, in_progress: 2, closed: 4, all: 6 })).toBe("all");
  });
});

describe("isContactFilter", () => {
  it("acepta los estados y 'all'", () => {
    expect(isContactFilter("in_progress")).toBe(true);
    expect(isContactFilter("all")).toBe(true);
  });

  it("rechaza cualquier otra cosa", () => {
    expect(isContactFilter("archived")).toBe(false);
    expect(isContactFilter(undefined)).toBe(false);
  });
});

describe("replyMailto", () => {
  const url = replyMailto(
    { name: "Marta Soler", email: "marta@example.com", service: "Aire acondicionado", message: "No enfría.\nHace ruido." },
    "Diplonautic",
  );
  const params = new URLSearchParams(url.split("?")[1]);

  it("va al email del cliente", () => {
    expect(url.startsWith("mailto:marta@example.com?")).toBe(true);
  });

  it("lleva asunto con el servicio y la empresa", () => {
    expect(params.get("subject")).toBe("Re: Aire acondicionado · Diplonautic");
  });

  it("saluda por el nombre y cita la consulta línea a línea", () => {
    const body = params.get("body") ?? "";
    expect(body.startsWith("Hola Marta,")).toBe(true);
    expect(body).toContain("> No enfría.\n> Hace ruido.");
  });
});
