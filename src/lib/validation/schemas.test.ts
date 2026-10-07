import { describe, expect, it } from "vitest";
import {
  contactSchema,
  fieldErrors,
  forumThreadSchema,
  invitationSchema,
  memberUpdateSchema,
  signUpSchema,
  timeCorrectionSchema,
  taskHoursSchema,
  vacationRequestSchema,
} from "./schemas";

describe("signUpSchema", () => {
  it("normaliza email y acepta contraseña válida", () => {
    const r = signUpSchema.parse({ fullName: " Ana ", email: " ANA@Demo.com ", password: "secreto123" });
    expect(r).toEqual({ fullName: "Ana", email: "ana@demo.com", password: "secreto123" });
  });

  it("exige letras y números en la contraseña", () => {
    const r = signUpSchema.safeParse({ fullName: "Ana", email: "a@b.com", password: "solamente" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).password).toContain("Debe incluir un número");
  });
});

describe("taskHoursSchema", () => {
  const base = { taskId: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f", date: "2026-10-05" };

  it("acepta fracciones de 15 minutos", () => {
    expect(taskHoursSchema.parse({ ...base, hours: "1.75" }).hours).toBe(1.75);
  });

  it("rechaza fracciones arbitrarias y rangos fuera de límite", () => {
    expect(taskHoursSchema.safeParse({ ...base, hours: "1.3" }).success).toBe(false);
    expect(taskHoursSchema.safeParse({ ...base, hours: "0" }).success).toBe(false);
    expect(taskHoursSchema.safeParse({ ...base, hours: "13" }).success).toBe(false);
  });
});

describe("vacationRequestSchema", () => {
  it("rechaza fin anterior al inicio con error en endDate", () => {
    const r = vacationRequestSchema.safeParse({ startDate: "2026-10-10", endDate: "2026-10-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).endDate).toBeDefined();
  });

  it("convierte motivo vacío en null", () => {
    expect(
      vacationRequestSchema.parse({ startDate: "2026-10-10", endDate: "2026-10-12", reason: "" }).reason,
    ).toBeNull();
  });
});

describe("invitationSchema", () => {
  it("no permite invitar como owner", () => {
    expect(invitationSchema.safeParse({ email: "x@y.com", role: "owner" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "x@y.com", role: "manager" }).success).toBe(true);
  });

  it("manager vacío se transforma en undefined", () => {
    expect(invitationSchema.parse({ email: "x@y.com", role: "employee", managerId: "" }).managerId).toBeUndefined();
  });
});

describe("corrección de fichaje", () => {
  const base = { start: "2026-09-01T07:00:00.000Z", end: "2026-09-01T15:00:00.000Z", reason: "Me olvidé de fichar" };

  it("acepta un tramo pasado con motivo", () => {
    expect(timeCorrectionSchema.safeParse(base).success).toBe(true);
    expect(timeCorrectionSchema.safeParse({ ...base, entryId: "" }).success).toBe(true);
  });

  it("rechaza salida antes de la entrada, tramos larguísimos, horas futuras y motivos vacíos", () => {
    const err = (v: object) => fieldErrors(timeCorrectionSchema.safeParse({ ...base, ...v }).error!);
    expect(err({ end: "2026-09-01T06:00:00.000Z" }).end).toEqual(["La salida tiene que ser posterior a la entrada"]);
    expect(err({ end: "2026-09-02T07:00:00.000Z" }).end).toEqual(["Un tramo no puede superar las 16 horas"]);
    expect(err({ start: "2099-01-01T07:00:00.000Z", end: "2099-01-01T08:00:00.000Z" }).end).toEqual(["No se pueden corregir horas futuras"]);
    expect(err({ reason: " " }).reason).toEqual(["Contá brevemente qué pasó"]);
  });
});

describe("solicitud de ausencia", () => {
  it("por defecto es de vacaciones y \"otra ausencia\" exige motivo", () => {
    expect(vacationRequestSchema.parse({ startDate: "2026-11-02", endDate: "2026-11-02" }).kind).toBe("vacation");
    const other = vacationRequestSchema.safeParse({ kind: "other", startDate: "2026-11-02", endDate: "2026-11-02" });
    expect(fieldErrors(other.error!).reason).toEqual(["Contá de qué se trata la ausencia"]);
  });
});

describe("formulario de contacto", () => {
  const valid = {
    name: "  Marta Soler ",
    email: "MARTA@correo.com",
    phone: "",
    boatType: "Velero",
    boatModel: "",
    service: "Generadores",
    message: "El generador no arranca desde la última salida.",
    privacy: "on",
  };

  it("acepta una consulta completa y normaliza los opcionales", () => {
    const r = contactSchema.parse(valid);
    expect(r).toMatchObject({ name: "Marta Soler", email: "marta@correo.com", phone: null, boatModel: null });
  });

  it("exige la conformidad, un servicio de la lista y un mensaje con contenido", () => {
    const r = contactSchema.safeParse({ ...valid, privacy: undefined, service: "Pesca", message: "hola" });
    expect(r.success).toBe(false);
    expect(Object.keys(fieldErrors(r.error!)).sort()).toEqual(["message", "privacy", "service"]);
  });

  it("valida el teléfono solo si se completa", () => {
    expect(contactSchema.safeParse({ ...valid, phone: "+34 600 123 456" }).success).toBe(true);
    expect(contactSchema.safeParse({ ...valid, phone: "llamame" }).success).toBe(false);
  });
});

describe("hilo del foro", () => {
  it("recorta espacios y rechaza títulos cortos o categorías inventadas", () => {
    expect(forumThreadSchema.parse({ category: "notice", title: "  Cierre por fiestas ", body: "El 12 cerramos." }).title).toBe(
      "Cierre por fiestas",
    );
    expect(forumThreadSchema.safeParse({ category: "notice", title: "Hola", body: "x" }).success).toBe(false);
    expect(forumThreadSchema.safeParse({ category: "spam", title: "Título válido", body: "x" }).success).toBe(false);
  });
});

describe("edición de una persona (administración)", () => {
  const base = {
    membershipId: "bbbbbbbb-0000-0000-0000-000000000003",
    role: "employee",
    position: "Técnica",
    weeklyHours: "40",
  };

  it("el nombre vacío no se toca (la persona todavía no lo eligió)", () => {
    const r = memberUpdateSchema.safeParse({ ...base, fullName: "" });
    expect(r.success && r.data.fullName).toBe(undefined);
  });

  it("recorta espacios y exige al menos 2 caracteres", () => {
    expect(memberUpdateSchema.safeParse({ ...base, fullName: "  Ana Torres  " }).data?.fullName).toBe("Ana Torres");
    expect(memberUpdateSchema.safeParse({ ...base, fullName: "A" }).success).toBe(false);
  });
});
