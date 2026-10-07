import "server-only";
import { cache } from "react";
import { getEmployees } from "@/lib/data/employees";
import { displayName } from "@/lib/domain/hierarchy";
import { createClient } from "@/lib/supabase/server";
import type { ContactMessage } from "@/lib/supabase/database.types";

export type ContactMessageWithHandler = ContactMessage & { handler: string | null };

/** Mensajes de la web sin abrir (para el contador del menú). RLS: solo con contact.manage. */
export const getContactNewCount = cache(async (orgId: string): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("contact_new_count", { p_org_id: orgId });
  return data ?? 0;
});

/** RLS: solo quien tiene contact.manage lee los mensajes de la web. */
export const getContactMessages = cache(async (orgId: string): Promise<ContactMessageWithHandler[]> => {
  const supabase = await createClient();
  const [{ data, error }, employees] = await Promise.all([
    supabase.from("contact_messages").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(500),
    getEmployees(orgId),
  ]);
  if (error) throw error;
  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
  return (data ?? []).map((m) => ({ ...m, handler: m.handled_by ? (names.get(m.handled_by) ?? "Ex miembro") : null }));
});
