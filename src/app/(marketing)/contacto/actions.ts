"use server";

import { fail, ok, type ActionState } from "@/lib/actions";
import { contactSchema, fieldErrors } from "@/lib/validation/schemas";

/**
 * Formulario de contacto. La prueba pide un formulario visual: se valida en el
 * servidor igual que uno real, pero el mensaje no se guarda ni se envía.
 */
export async function sendContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Campo trampa invisible: si viene relleno, es un bot. Se responde como si nada.
  if (formData.get("website")) return ok();

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const firstName = parsed.data.name.split(" ")[0];
  return ok(`Gracias, ${firstName}. Te respondemos en menos de 24 horas laborables a ${parsed.data.email}.`);
}
