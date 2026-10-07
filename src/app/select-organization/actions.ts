"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function acceptInvitation(invitationId: string) {
  await requireUser();
  const id = z.guid().parse(invitationId);
  const supabase = await createClient();

  const { data: invitation } = await supabase.from("invitations").select("org_id").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("accept_invitation", { p_invitation_id: id });
  if (error || !invitation) redirect("/select-organization?error=invitation");

  redirect(`/app/${invitation.org_id}/dashboard`);
}
