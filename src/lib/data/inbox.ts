import "server-only";
import { cache } from "react";
import { getHeadedDepartmentId } from "@/lib/data/departments";
import { getProjects, getTasks } from "@/lib/data/projects";
import { getOrgContext } from "@/lib/data/session";
import { getOpenClock } from "@/lib/data/time";
import { getAllWorkOrders } from "@/lib/data/work-orders";
import { buildPending, type PendingItem } from "@/lib/domain/inbox";
import { todayISO } from "@/lib/domain/periods";
import { canManageProject } from "@/lib/domain/projects";
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
const MIRRORED_BY_PENDING = ["work_order.to_invoice"];

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


/** Lo que espera una acción del usuario actual en esta organización. */
export const getPending = cache(async (orgId: string): Promise<PendingItem[]> => {
  const ctx = await getOrgContext(orgId);
  const me = ctx.membership.id;
  const today = todayISO();
  const [projects, tasks, workOrders, openClock, headed] = await Promise.all([
    getProjects(orgId),
    getTasks(orgId),
    getAllWorkOrders(orgId),
    getOpenClock(me),
    getHeadedDepartmentId(orgId, me),
  ]);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const access = { managesAllProjects: ctx.can("projects.manage"), headOfDepartmentId: headed, memberOf: new Set<string>() };
  const manageable = new Set(projects.filter((p) => p.status === "active" && canManageProject(access, p)).map((p) => p.id));

  return buildPending({
    orgId,
    today,
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
