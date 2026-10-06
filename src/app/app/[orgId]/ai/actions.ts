"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { answerQuestion } from "@/lib/ai/assistant";
import { suggestAllocation, teamSummary } from "@/lib/ai/features";
import { AiError, aiEnabled } from "@/lib/ai/openrouter";
import { dbErrorMessage } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import type { AllocationItem } from "@/lib/domain/ai";
import { todayISO } from "@/lib/domain/periods";
import { createClient } from "@/lib/supabase/server";

type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const DISABLED = "La IA no está activada. Agregá OPENROUTER_API_KEY al entorno para usarla.";

async function guarded<T>(fn: () => Promise<T>): Promise<AiResult<T>> {
  if (!aiEnabled()) return { ok: false, error: DISABLED };
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? e.message : "Algo salió mal con la IA. Probá de nuevo." };
  }
}

export async function askAssistant(orgId: string, question: string): Promise<AiResult<string>> {
  await getOrgContext(orgId);
  const q = question.trim();
  if (q.length < 3) return { ok: false, error: "Escribí una pregunta un poco más larga." };
  return guarded(() => answerQuestion(orgId, q));
}

export async function suggestHours(orgId: string): Promise<AiResult<Awaited<ReturnType<typeof suggestAllocation>>>> {
  await getOrgContext(orgId);
  return guarded(() => suggestAllocation(orgId));
}

export async function summarizeTeam(orgId: string): Promise<AiResult<string>> {
  const ctx = await getOrgContext(orgId);
  if (!ctx.can("time.view_team")) return { ok: false, error: "El resumen es para quien tiene equipo a cargo." };
  return guarded(() => teamSummary(orgId));
}

const applySchema = z
  .array(z.object({ taskId: z.guid(), hours: z.number().min(0.25).max(12) }))
  .min(1)
  .max(20);

/** Imputa hoy el reparto que la persona revisó (cada línea, con las mismas reglas que a mano). */
export async function applyAllocation(orgId: string, items: Pick<AllocationItem, "taskId" | "hours">[]): Promise<AiResult<number>> {
  const { membership } = await getOrgContext(orgId);
  const parsed = applySchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "El reparto no es válido." };

  const supabase = await createClient();
  // Mediodía UTC del día: misma convención que la carga manual de horas
  let start = new Date(`${todayISO()}T12:00:00Z`).getTime();
  const rows = parsed.data.map((i) => {
    const row = {
      membership_id: membership.id,
      entry_type: "task" as const,
      task_id: i.taskId,
      started_at: new Date(start).toISOString(),
      ended_at: new Date(start + i.hours * 3_600_000).toISOString(),
    };
    start += i.hours * 3_600_000;
    return row;
  });
  const { error } = await supabase.from("time_entries").insert(rows);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/app/${orgId}`, "layout");
  return { ok: true, data: rows.length };
}
