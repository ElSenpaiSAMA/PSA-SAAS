import { describe, expect, it } from "vitest";
import { contactConfirmationEmail, escapeHtml } from "./contact-confirmation";

const company = {
  name: "Diplonautic",
  email: "info@diplonautic.com",
  phone: "+34 930 247 180",
  phoneHref: "tel:+34930247180",
  address: "Carrer de Neus Català, Local 9",
  city: "08930 Sant Adrià de Besòs, Barcelona",
  hours: "Lunes a viernes, 9:00 – 13:00 y 14:30 – 18:00",
  siteUrl: "https://diplonautic.vercel.app",
};

const input = {
  name: "Marta Soler",
  service: "Aire acondicionado",
  boatType: "Velero",
  boatModel: "Beneteau Oceanis 41",
  message: "El aire enfría poco.\nHace ruido al arrancar.",
};

describe("contactConfirmationEmail", () => {
  const mail = contactConfirmationEmail(input, company);

  it("saluda por el nombre y nombra a la empresa en el asunto", () => {
    expect(mail.subject).toBe("Recibimos tu consulta · Diplonautic");
    expect(mail.text.startsWith("Hola Marta:")).toBe(true);
    expect(mail.html).toContain("Hola Marta, recibimos tu consulta");
  });

  it("resume la consulta: servicio, barco y mensaje", () => {
    expect(mail.text).toContain("- Servicio: Aire acondicionado");
    expect(mail.text).toContain("- Barco: Velero · Beneteau Oceanis 41");
    expect(mail.text).toContain("El aire enfría poco.\nHace ruido al arrancar.");
  });

  it("sin modelo, muestra solo el tipo de barco", () => {
    expect(contactConfirmationEmail({ ...input, boatModel: null }, company).text).toContain("- Barco: Velero\n");
  });

  it("nunca inyecta el HTML que escribe la persona", () => {
    const evil = contactConfirmationEmail({ ...input, name: "<script>x</script>", message: '<img src=x onerror="alert(1)">' }, company);
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).not.toContain("<img");
    expect(evil.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});

describe("escapeHtml", () => {
  it("escapa los caracteres especiales", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
