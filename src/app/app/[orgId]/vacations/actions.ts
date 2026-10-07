"use server";

import { reportDbError } from "@/lib/errors/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getHolidaySet } from "@/lib/data/calendar";
import { getOrgContext } from "@/lib/data/session";
import { getVisibleVacationRequests } from "@/lib/data/vacations";
import { ABSENCE_LABEL, businessDays, canDecide, validateNewRequest, vacationBalance, type RequestValidationError } from "@/lib/domain/vacations";
import { createClient } from "@/lib/supabase/server";
import { decisionNoteSchema, fieldErrors, vacationRequestSchema } from "@/lib/validation/schemas";

const MESSAGES: Record<RequestValidationError, { field: "startDate" | "endDate"; text: string }> = {
  invalid_range: { field: "endDate", text: "La fecha de fin debe ser posterior al inicio." },
  starts_in_past: { field: "startDate", text: "No podés solicitar días pasados." },
  overlaps_existing: { field: "startDate", text: "Se solapa con otra solicitud tuya." },
  insufficient_balance: { field: "endDate", text: "No te alcanzan los días disponibles." },
  no_business_days: { field: "endDate", text: "El rango no incluye días hábiles." },
};

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

export async function requestVacation(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await getOrgContext(orgId);
  const parsed = vacationRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const { kind, startDate, endDate, reason } = parsed.data;
  const mine = await getVisibleVacationRequests([membership.id]);
  const year = Number(startDate.slice(0, 4));
  const holidays = await getHolidaySet(orgId, `${year - 1}-01-01`, `${year + 1}-12-31`);
  const balance = vacationBalance(membership.annual_vacation_days, mine, year, holidays);
  const today = new Date().toISOString().slice(0, 10);

  const problem = validateNewRequest({ start_date: startDate, end_date: endDate }, mine, balance, today, holidays, kind);
  if (problem) {
    const { field, text } = MESSAGES[problem];
    return fail(text, { [field]: [text] });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vacation_requests").insert({
    membership_id: membership.id,
    start_date: startDate,
    end_date: endDate,
    reason,
    kind,
  });
  if (error) return fail(await reportDbError(error));

  refresh(orgId);
  const days = businessDays({ start_date: startDate, end_date: endDate }, holidays);
  return ok(`Solicitud enviada · ${ABSENCE_LABEL[kind]} · ${days} ${days === 1 ? "día hábil" : "días hábiles"}`);
}

export async function cancelVacation(orgId: string, requestId: string): Promise<ActionState> {
  const { membership } = await getOrgContext(orgId);
  const id = z.guid().parse(requestId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vacation_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("membership_id", membership.id)
    .eq("status", "pending")
    .select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("La solicitud ya no está pendiente.");
  refresh(orgId);
  return ok("Solicitud cancelada");
}

export async function decideVacation(
  orgId: string,
  requestId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("vacations.approve")) return fail("No tenés permisos para aprobar vacaciones.");
  const id = z.guid().parse(requestId);
  const status = z.enum(["approved", "rejected"]).parse(decision);
  const parsedNote = decisionNoteSchema.safeParse(note ?? "");
  if (!parsedNote.success) return fail(parsedNote.error.issues[0].message);
  const decisionNote = parsedNote.data || null;
  if (status === "rejected" && !decisionNote) return fail("Contale a la persona por qué la rechazás.");

  const supabase = await createClient();
  const { data: request } = await supabase.from("vacation_requests").select("*").eq("id", id).maybeSingle();
  if (!request || !canDecide(request, ctx.membership.id)) return fail("No podés decidir sobre esta solicitud.");

  // decided_by y decided_at los fija un trigger en la base
  const { error } = await supabase.from("vacation_requests").update({ status, decision_note: decisionNote }).eq("id", id);
  if (error) return fail(await reportDbError(error));

  refresh(orgId);
  if (status === "rejected") return ok("Solicitud rechazada");
  return ok(request.kind === "vacation" ? "Vacaciones aprobadas" : `${ABSENCE_LABEL[request.kind]}: aprobada`);
}
