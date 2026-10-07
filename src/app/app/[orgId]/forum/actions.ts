"use server";

import { reportDbError } from "@/lib/errors/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/actions";
import { getOrgContext } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, forumPostSchema, forumThreadSchema } from "@/lib/validation/schemas";

function refresh(orgId: string) {
  revalidatePath(`/app/${orgId}`, "layout");
}

// Menciones elegidas en el formulario: la base las filtra a personas activas de la empresa
const mentionsSchema = z.array(z.guid()).max(20);
function parseMentions(formData: FormData): string[] {
  try {
    const parsed = mentionsSchema.safeParse(JSON.parse(String(formData.get("mentions") ?? "[]")));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Marca el foro como visto: el aviso del menú vuelve a cero. */
export async function markForumSeen(orgId: string): Promise<void> {
  const ctx = await getOrgContext(orgId);
  const supabase = await createClient();
  await supabase.from("forum_reads").upsert({ membership_id: ctx.membership.id, org_id: orgId });
  revalidatePath(`/app/${orgId}`, "layout");
}

// La autoría y los permisos los aplica la base (RLS + guards): acá solo se valida
// el formulario y se traducen los errores.

export async function createThread(orgId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const parsed = forumThreadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_threads")
    .insert({ author_id: ctx.membership.id, ...parsed.data, mentions: parseMentions(formData) })
    .select("id")
    .single();
  if (error) return fail(await reportDbError(error));
  refresh(orgId);
  redirect(`/app/forum/${data.id}`);
}

export async function replyToThread(orgId: string, threadId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getOrgContext(orgId);
  const parsed = forumPostSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá la respuesta.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("forum_posts")
    .insert({
      thread_id: z.guid().parse(threadId),
      // Respuesta a otra respuesta del hilo (la base valida que sea del mismo hilo)
      parent_id: z.guid().safeParse(formData.get("parentId")).data ?? null,
      author_id: ctx.membership.id,
      body: parsed.data.body,
      mentions: parseMentions(formData),
    });
  if (error) return fail(await reportDbError(error));
  refresh(orgId);
  return ok("Respuesta publicada");
}

export async function editThread(orgId: string, threadId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = forumThreadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá los campos marcados.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_threads")
    .update(parsed.data)
    .eq("id", z.guid().parse(threadId))
    .select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("Solo quien escribió el hilo puede editarlo.");
  refresh(orgId);
  return ok("Hilo actualizado");
}

const flagsSchema = z
  .object({ pinned: z.boolean(), locked: z.boolean(), resolved: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

const FLAG_MESSAGE = {
  pinned: ["Hilo fijado arriba", "Hilo desfijado"],
  locked: ["Hilo cerrado: ya no admite respuestas", "Hilo reabierto"],
  resolved: ["Marcado como resuelto", "Marcado como pendiente"],
} as const;

/** Fijar / cerrar (moderación) y marcar resuelto (autor o moderación). */
export async function setThreadFlags(
  orgId: string,
  threadId: string,
  flags: Partial<Record<"pinned" | "locked" | "resolved", boolean>>,
): Promise<ActionState> {
  await getOrgContext(orgId);
  const parsed = flagsSchema.safeParse(flags);
  if (!parsed.success) return fail("Cambio no válido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_threads")
    .update(parsed.data)
    .eq("id", z.guid().parse(threadId))
    .select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("No tenés permisos para este cambio.");
  refresh(orgId);
  const [key, value] = Object.entries(parsed.data)[0] as [keyof typeof FLAG_MESSAGE, boolean];
  return ok(FLAG_MESSAGE[key][value ? 0 : 1]);
}

export async function deleteThread(orgId: string, threadId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("forum_threads").delete().eq("id", z.guid().parse(threadId)).select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("No tenés permisos para borrar este hilo.");
  refresh(orgId);
  redirect(`/app/forum`);
}

export async function deletePost(orgId: string, postId: string): Promise<ActionState> {
  await getOrgContext(orgId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("forum_posts").delete().eq("id", z.guid().parse(postId)).select("id");
  if (error) return fail(await reportDbError(error));
  if (!data?.length) return fail("No tenés permisos para borrar esta respuesta.");
  refresh(orgId);
  return ok("Respuesta borrada");
}
