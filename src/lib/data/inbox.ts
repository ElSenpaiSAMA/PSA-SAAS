import "server-only";
import { cache } from "react";
import { getHolidaySet } from "@/lib/data/calendar";
import { getHeadedDepartmentId } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getProjects, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getOpenClock } from "@/lib/data/time";
import { getAllWorkOrders } from "@/lib/data/work-orders";
import { displayName } from "@/lib/domain/hierarchy";
import { buildPending, type PendingItem } from "@/lib/domain/inbox";
import { todayISO } from "@/lib/domain/periods";
import { hasPermission, isRole } from "@/lib/domain/permissions";
import { canManageProject } from "@/lib/domain/projects";
import { businessDays, naturalApprovers } from "@/lib/domain/vacations";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/supabase/database.types";

export const getNotifications = cache(async (membershipId: string, limit = 60): Promise<Notification[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", membershipId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
});

/** Avisos que ya aparecen como "pendiente" en la bandeja: no se cuentan dos veces. */
const MIRRORED_BY_PENDING = ["vacation.requested", "work_order.to_invoice"];

export const getUnreadCount = cache(async (membershipId: string): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", membershipId)
    .is("read_at", null)
    .not("kind", "in", `(${MIRRORED_BY_PENDING.join(",")})`);
  return count ?? 0;
});

const can = (role: string, permission: Parameters<typeof hasPermission>[1]) => isRole(role) && hasPermission(role, permission);

/** Lo que espera una acción del usuario actual en esta organización. */
export const getPending = cache(async (orgId: string): Promise<PendingItem[]> => {
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership.id;
  const today = todayISO();
  const supabase = await createClient();

  const [employees, projects, tasks, workOrders, openClock, headed] = await Promise.all([
    getEmployees(orgId),
    getProjects(orgId),
    getTasks(orgId),
    getAllWorkOrders(orgId),
    getOpenClock(me),
    getHeadedDepartmentId(orgId, me),
  ]);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  // Vacaciones: solo las que me tocan como aprobador natural (no toda la org si soy admin)
  let vacationsToDecide: Parameters<typeof buildPending>[0]["vacationsToDecide"] = [];
  if (ctx.can("vacations.approve")) {
    // vacation_requests no tiene org_id: se acota a los miembros de esta organización
    // (alguien que está en dos empresas no debe ver pendientes de la otra)
    const { data: pending } = await supabase
      .from("vacation_requests")
      .select("*")
      .eq("status", "pending")
      .in(
        "membership_id",
        employees.filter((e) => e.id !== me).map((e) => e.id),
      );
    const mine = (pending ?? []).filter((r) =>
      naturalApprovers(
        employees,
        r.membership_id,
        (role) => can(role, "vacations.approve"),
        (role) => can(role, "employees.manage"),
      ).includes(me),
    );
    if (mine.length) {
      const years = mine.flatMap((r) => [r.start_date.slice(0, 4), r.end_date.slice(0, 4)]).sort();
      const holidays = await getHolidaySet(orgId, `${years[0]}-01-01`, `${years[years.length - 1]}-12-31`);
      const names = new Map(employees.map((e) => [e.id, displayName(e.profile)]));
      vacationsToDecide = mine.map((r) => ({
        id: r.id,
        requester: names.get(r.membership_id) ?? "Alguien",
        start_date: r.start_date,
        end_date: r.end_date,
        created_at: r.created_at,
        days: businessDays(r, holidays),
      }));
    }
  }

  const access = { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set<string>() };
  const manageable = new Set(projects.filter((p) => p.status === "active" && canManageProject(access, p)).map((p) => p.id));

  return buildPending({
    orgId,
    today,
    vacationsToDecide,
    toInvoice: ctx.can("billing.manage")
      ? workOrders
          .filter((w) => w.status === "closed" && w.billing_status === "unbilled")
          .map((w) => ({ id: w.id, title: w.title, period_end: w.period_end, project: projectName.get(w.project_id) ?? "Proyecto" }))
      : [],
    managedWorkOrders: workOrders
      .filter((w) => manageable.has(w.project_id) && w.billing_status === "unbilled")
      .map((w) => ({
        id: w.id,
        title: w.title,
        status: w.status,
        period_start: w.period_start,
        period_end: w.period_end,
        project: projectName.get(w.project_id) ?? "Proyecto",
      })),
    myTasks: tasks
      .filter((t) => t.assigned_to === me)
      .map((t) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        status: t.status,
        project_id: t.project_id,
        project: projectName.get(t.project_id) ?? "Proyecto",
      })),
    openClockSince: openClock?.started_at ?? null,
  });
});
