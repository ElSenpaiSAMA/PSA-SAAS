import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { getBranches, getDepartments } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { requirePermission } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { createClient } from "@/lib/supabase/server";
import { StructureEditor, type Unit } from "./structure-editor";

export const metadata: Metadata = { title: "Estructura" };

export default async function StructurePage({ params }: PageProps<"/app/[orgId]/structure">) {
  const { orgId } = await params;
  await requirePermission(orgId, "platform.manage");
  const supabase = await createClient();
  const [branches, departments, employees, branchPerms, departmentPerms] = await Promise.all([
    getBranches(orgId),
    getDepartments(orgId),
    getEmployees(orgId),
    supabase
      .from("branch_permissions")
      .select("*")
      .then((r) => r.data ?? []),
    supabase
      .from("department_permissions")
      .select("*")
      .then((r) => r.data ?? []),
  ]);
  const name = new Map(employees.map((e) => [e.id, displayName(e.profile)]));

  const branchUnits: Unit[] = branches.map((b) => ({
    kind: "branch",
    id: b.id,
    name: b.name,
    color: b.color,
    who: employees
      .filter((e) => e.role_id === "director" && e.directs_branch_id === b.id)
      .map((e) => name.get(e.id) ?? "—")
      .join(", "),
    detail: departments
      .filter((d) => d.branch_id === b.id)
      .map((d) => d.name)
      .join(" · "),
    permissions: branchPerms.filter((p) => p.branch_id === b.id).map((p) => p.permission_key),
  }));
  const departmentUnits: Unit[] = departments.map((d) => ({
    kind: "department",
    id: d.id,
    name: d.name,
    color: branches.find((b) => b.id === d.branch_id)?.color ?? null,
    who: d.head_id ? (name.get(d.head_id) ?? "—") : "",
    detail: branches.find((b) => b.id === d.branch_id)?.name ?? "Sin rama",
    permissions: departmentPerms.filter((p) => p.department_id === d.id).map((p) => p.permission_key),
  }));

  return (
    <>
      <PageHeader
        title="Estructura"
        accent="de permisos"
        description="Qué gestiona para toda la empresa cada rama (lo recibe quien la dirige) y cada departamento (lo recibe su responsable). Es configuración de la plataforma: los niveles, a quién reporta cada uno y los proyectos se gestionan en la empresa."
      />
      <StructureEditor orgId={orgId} branches={branchUnits} departments={departmentUnits} />
    </>
  );
}
