// Email de confirmación para quien escribe desde el formulario de contacto. Puro (sin
// envío): arma asunto, HTML y texto plano, y se puede testear.

export interface ContactConfirmationInput {
  name: string;
  service: string;
  boatType: string;
  boatModel: string | null;
  message: string;
}

export interface CompanyInfo {
  name: string;
  email: string;
  phone: string;
  phoneHref: string;
  address: string;
  city: string;
  hours: string;
  siteUrl: string;
}

/** Lo que escribió la persona se escapa: nunca se inyecta HTML en el email. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function contactConfirmationEmail(input: ContactConfirmationInput, company: CompanyInfo) {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;
  const boat = input.boatModel ? `${input.boatType} · ${input.boatModel}` : input.boatType;
  const subject = `Recibimos tu consulta · ${company.name}`;

  const text = [
    `Hola ${firstName}:`,
    "",
    `Gracias por escribir a ${company.name}. Recibimos tu consulta y te respondemos en menos de 24 horas laborables.`,
    "",
    "Tu consulta:",
    `- Servicio: ${input.service}`,
    `- Barco: ${boat}`,
    "",
    input.message,
    "",
    `Si es urgente, llamanos al ${company.phone} (${company.hours}).`,
    "",
    `${company.name}`,
    `${company.address}, ${company.city}`,
    company.siteUrl,
    "",
    "Recibís este email porque completaste el formulario de contacto de nuestra web.",
  ].join("\n");

  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#0b1f3a;padding:22px 28px;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">${e(company.name)}</td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;font-size:18px;font-weight:bold;">Hola ${e(firstName)}, recibimos tu consulta</p>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                  Gracias por escribirnos. Un técnico la revisa y te respondemos en <strong>menos de 24 horas laborables</strong>.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:13px;line-height:1.6;color:#334155;">
                      <strong style="color:#0f172a;">Servicio:</strong> ${e(input.service)}<br />
                      <strong style="color:#0f172a;">Barco:</strong> ${e(boat)}
                      <p style="margin:12px 0 0;white-space:pre-line;color:#0f172a;">${e(input.message)}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#334155;">
                  Si es urgente, llamanos al <a href="${e(company.phoneHref)}" style="color:#2563eb;">${e(company.phone)}</a>
                  (${e(company.hours)}).
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
                ${e(company.name)} · ${e(company.address)}, ${e(company.city)}<br />
                <a href="${e(company.siteUrl)}" style="color:#2563eb;">${e(company.siteUrl.replace(/^https?:\/\//, ""))}</a><br />
                Recibís este email porque completaste el formulario de contacto de nuestra web.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
