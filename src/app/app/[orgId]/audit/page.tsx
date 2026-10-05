import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { getAuditLog } from "@/lib/data/audit";
import { getEmployees } from "@/lib/data/employees";
import { requirePermission } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { AuditFeed } from "./audit-feed";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage({ params }: PageProps<"/app/[orgId]/audit">) {
  const { orgId } = await params;
  await requirePermission(orgId, "employees.manage");
  const [entries, employees] = await Promise.all([getAuditLog(orgId, 200), getEmployees(orgId)]);
  const names = Object.fromEntries(employees.map((e) => [e.user_id, displayName(e.profile)]));

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Registro inmutable de quién hizo qué y cuándo dentro de la organización. Tocá un evento para ver el detalle del cambio."
      />
      <Card>
        <CardBody>
          <AuditFeed entries={entries} names={names} />
        </CardBody>
      </Card>
    </>
  );
}
