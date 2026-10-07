import type { Metadata } from "next";
import { Building2, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { getDepartments } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { requirePermission } from "@/lib/data/session";
import { recordAt } from "@/lib/domain/employee-records";
import { displayName, supervisedIds } from "@/lib/domain/hierarchy";
import { isRole, ROLE_LABEL } from "@/lib/domain/permissions";
import { todayISO } from "@/lib/domain/periods";
import { createClient } from "@/lib/supabase/server";
import { StaffTable, type StaffRow } from "./staff-table";

export const metadata: Metadata = { title: "Empleados" };

export default async function StaffPage({ params }: PageProps<"/app/[orgId]/staff">) {
  const { orgId } = await params;
  const ctx = await requirePermission(orgId, "workspace.access");
  const sensitive = ctx.can("people.sensitive");
  // Con people.view se abren las fichas de quienes supervisa; sin él, es un directorio básico
  const seesTeam = ctx.can("people.view");

  const supabase = await createClient();
  const [employees, departments, records] = await Promise.all([
    getEmployees(orgId),
    getDepartments(orgId),
    // RLS: con people.sensitive vuelven todas las fichas; si no, solo la propia
    sensitive
      ? supabase
          .from("employee_records")
          .select("*")
          .eq("org_id", orgId)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
  const supervised = seesTeam ? supervisedIds(employees, ctx.membership.id, ctx.can("employees.manage")) : new Set<string>();
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const today = todayISO();

  const rows: StaffRow[] = employees
    .map((e) => ({
      id: e.id,
      name: displayName(e.profile),
      avatar: e.profile?.avatar_url ?? null,
      email: e.profile?.email ?? null,
      position: e.position,
      roleLabel: isRole(e.role_id) ? ROLE_LABEL[e.role_id] : e.role_id,
      departmentId: e.department_id,
      departmentName: e.department_id ? (deptName.get(e.department_id) ?? null) : null,
      managerName: e.manager_id ? (names.get(e.manager_id) ?? null) : null,
      reports: employees.filter((x) => x.manager_id === e.id && x.status === "active").length,
      status: e.status,
      hireDate: sensitive
        ? (recordAt(
            records.filter((r) => r.membership_id === e.id),
            today,
          )?.hire_date ?? null)
        : null,
      isMe: e.id === ctx.membership.id,
      canOpen: e.id === ctx.membership.id || supervised.has(e.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const active = rows.filter((r) => r.status === "active");

  return (
    <>
      <PageHeader
        title={seesTeam ? "Empleados" : "Directorio"}
        description={
          seesTeam
            ? "Todas las personas de la empresa. Abrí el perfil de alguien de tu equipo para ver su ficha, su trabajo, sus horas y vacaciones."
            : "Quién es quién en la empresa: puesto y departamento de cada persona."
        }
      />
      <div className="mb-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <StatCard index={0} label="Empleados activos" value={active.length} icon={Users} />
        <StatCard index={1} label="Con personas a cargo" value={active.filter((r) => r.reports > 0).length} icon={UserCheck} />
        <StatCard index={2} label="Departamentos" value={departments.length} icon={Building2} />
      </div>
      <StaffTable orgId={orgId} rows={rows} departments={departments.map((d) => ({ id: d.id, name: d.name }))} showHireDate={sensitive} />
    </>
  );
}
