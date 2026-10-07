import { redirect } from "next/navigation";

export default async function OrgIndex({ params }: PageProps<"/app/[orgId]">) {
  const { orgId } = await params;
  redirect(`/app/${orgId}/dashboard`);
}
