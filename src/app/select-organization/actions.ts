"use server";

import { redirect } from "next/navigation";
import { dbErrorMessage, fail, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, organizationSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Revisá el nombre.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organization", { p_name: parsed.data.name });
  if (error || !orgId) return fail(dbErrorMessage(error));

  await supabase.rpc("log_event", { p_action: "organization.created", p_org_id: orgId });
  redirect(`/app/${orgId}/dashboard`);
}

export async function acceptInvitation(invitationId: string) {
  await requireUser();
  const id = z.guid().parse(invitationId);
  const supabase = await createClient();

  const { data: invitation } = await supabase.from("invitations").select("org_id").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("accept_invitation", { p_invitation_id: id });
  if (error || !invitation) redirect("/select-organization?error=invitation");

  redirect(`/app/${invitation.org_id}/dashboard`);
}
