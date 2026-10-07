"use server";

import { fail, ok, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { contactSchema, fieldErrors } from "@/lib/validation/schemas";

/**
 * Formulario de contacto: el mensaje se guarda en la base (submit_contact_message)
 * y lo gestiona la empresa desde Intranet → Mensajes web.
 */
export async function sendContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Campo trampa invisible: si viene relleno, es un bot. Se responde como si nada.
  if (formData.get("website")) return ok();

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { name, email, phone, boatType, boatModel, service, message } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_contact_message", {
    p_name: name,
    p_email: email,
    p_phone: phone,
    p_boat_type: boatType,
    p_boat_model: boatModel,
    p_service: service,
    p_message: message,
  });
  if (error) {
    if (error.message.includes("too many contact messages")) {
      return fail("Ya recibimos varios mensajes tuyos en la última hora. Te respondemos pronto.");
    }
    return fail("No pudimos enviar tu mensaje. Probá de nuevo o escribinos por email.");
  }

  const firstName = name.split(" ")[0];
  return ok(`Gracias, ${firstName}. Te respondemos en menos de 24 horas laborables a ${email}.`);
}
