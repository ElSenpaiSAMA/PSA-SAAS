import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/data/session";

export default async function OrgIndex({ params }: PageProps<"/app/[orgId]">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  // El superadmin no tiene "Inicio": entra a la plataforma
  redirect(`/app/${orgId}/${isPlatformOnly(ctx.can) ? "errors" : "dashboard"}`);
}

function isPlatformOnly(can: (p: "platform.manage" | "workspace.access") => boolean) {
  return can("platform.manage") && !can("workspace.access");
}
