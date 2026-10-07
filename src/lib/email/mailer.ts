import "server-only";
import nodemailer from "nodemailer";
import { logError } from "@/lib/errors/server";

/**
 * Envío de emails de la app por SMTP (Brevo, Gmail, Resend, el servidor de la empresa…).
 * Opcional: sin SMTP_HOST la app funciona igual y simplemente no envía.
 *
 *   SMTP_HOST, SMTP_PORT (587 por defecto; 465 = SSL), SMTP_USER, SMTP_PASS
 *   MAIL_FROM  remitente visible, p. ej. "Diplonautic <info@tudominio.com>"
 */
export function emailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

let transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

/** Envía un email. Nunca lanza: si falla, queda en el registro de errores y devuelve false. */
export async function sendEmail(mail: { to: string; subject: string; text: string; html: string; replyTo?: string }): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    await getTransport().sendMail({ from: process.env.MAIL_FROM, ...mail });
    return true;
  } catch (error) {
    await logError("server", error, { context: { what: "envío de email", subject: mail.subject } });
    return false;
  }
}
