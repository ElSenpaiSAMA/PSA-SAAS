// Tipos de la base (mantener en sync con supabase/migrations).
// Con Supabase local se pueden regenerar con:
//   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts

import type { Permission, Role } from "@/lib/domain/permissions";
import type { VacationStatus } from "@/lib/domain/vacations";
import type { BillingStatus, WorkOrderStatus } from "@/lib/domain/work-orders";

type Timestamp = string;
type DateString = string;

export type TaskStatus = "todo" | "in_progress" | "done";
export type EntryType = "clock" | "task";
export type MembershipStatus = "active" | "inactive";
export type ProjectStatus = "active" | "archived";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Organization = {
  id: string;
  name: string;
  created_at: Timestamp;
};

export type Membership = {
  id: string;
  org_id: string;
  user_id: string;
  role_id: Role;
  manager_id: string | null;
  department_id: string | null;
  position: string | null;
  weekly_hours: number;
  annual_vacation_days: number;
  status: MembershipStatus;
  created_at: Timestamp;
};

export type Project = {
  id: string;
  org_id: string;
  name: string;
  client_name: string | null;
  budgeted_hours: number | null;
  hourly_rate: number | null;
  department_id: string | null;
  status: ProjectStatus;
  created_at: Timestamp;
};

export type Task = {
  id: string;
  org_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  estimated_hours: number | null;
  status: TaskStatus;
  work_order_id: string | null;
  start_date: DateString | null;
  due_date: DateString | null;
  created_at: Timestamp;
};

export type TimeEntry = {
  id: string;
  membership_id: string;
  task_id: string | null;
  entry_type: EntryType;
  started_at: Timestamp;
  ended_at: Timestamp | null;
  created_at: Timestamp;
};

export type VacationRequest = {
  id: string;
  membership_id: string;
  start_date: DateString;
  end_date: DateString;
  status: VacationStatus;
  reason: string | null;
  decided_by: string | null;
  decided_at: Timestamp | null;
  created_at: Timestamp;
};

export type Invitation = {
  id: string;
  org_id: string;
  email: string;
  role_id: Exclude<Role, "owner">;
  manager_id: string | null;
  department_id: string | null;
  position: string | null;
  invited_by: string | null;
  accepted_at: Timestamp | null;
  created_at: Timestamp;
};

export type Department = {
  id: string;
  org_id: string;
  name: string;
  head_id: string | null;
  created_at: Timestamp;
};

export type WorkOrder = {
  id: string;
  org_id: string;
  project_id: string;
  number: number;
  title: string;
  period_start: DateString;
  period_end: DateString;
  budgeted_hours: number | null;
  hourly_rate: number | null;
  status: WorkOrderStatus;
  billing_status: BillingStatus;
  invoiced_at: Timestamp | null;
  created_by: string | null;
  created_at: Timestamp;
};

export type Holiday = {
  id: string;
  org_id: string;
  date: DateString;
  name: string;
  created_at: Timestamp;
};

export type AbsenceRow = {
  membership_id: string;
  start_date: DateString;
  end_date: DateString;
  status: "approved" | "pending";
};

export type WorkloadItemRow = {
  membership_id: string;
  task_id: string;
  estimated_hours: number;
  start_date: DateString;
  due_date: DateString;
};

export type ProjectMember = {
  project_id: string;
  membership_id: string;
  added_at: Timestamp;
};

export type AuditLog = {
  id: number;
  user_id: string | null;
  org_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: Timestamp;
};

export type VacationBalanceRow = {
  membership_id: string;
  org_id: string;
  allowance: number;
  year: number;
  used_days: number;
  pending_days: number;
};

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, "id">;
      organizations: Table<Organization, "name">;
      memberships: Table<Membership, "org_id" | "user_id" | "role_id">;
      projects: Table<Project, "org_id" | "name">;
      tasks: Table<Task, "project_id" | "title">;
      time_entries: Table<TimeEntry, "membership_id" | "entry_type">;
      vacation_requests: Table<VacationRequest, "membership_id" | "start_date" | "end_date">;
      invitations: Table<Invitation, "org_id" | "email">;
      departments: Table<Department, "org_id" | "name">;
      project_members: Table<ProjectMember, "project_id" | "membership_id">;
      work_orders: Table<WorkOrder, "project_id" | "title" | "period_start" | "period_end">;
      holidays: Table<Holiday, "org_id" | "date" | "name">;
      audit_log: Table<AuditLog, "action">;
      roles: Table<{ id: Role; name: string; level: number }, "id" | "name" | "level">;
      permissions: Table<{ key: Permission; description: string }, "key" | "description">;
      role_permissions: Table<{ role_id: Role; permission_key: Permission }, "role_id" | "permission_key">;
    };
    Views: {
      vacation_balances: { Row: VacationBalanceRow; Relationships: [] };
    };
    Functions: {
      create_organization: { Args: { p_name: string }; Returns: string };
      accept_invitation: { Args: { p_invitation_id: string }; Returns: string };
      log_event: {
        Args: { p_action: string; p_metadata?: Record<string, unknown>; p_org_id?: string };
        Returns: undefined;
      };
      has_permission: { Args: { p_org_id: string; p_key: string }; Returns: boolean };
      duplicate_work_order: {
        Args: { p_work_order_id: string; p_title: string; p_period_start: string; p_period_end: string };
        Returns: string;
      };
      org_absences: { Args: { p_org_id: string; p_from: string; p_to: string }; Returns: AbsenceRow[] };
      workload_items: { Args: { p_org_id: string; p_from: string; p_to: string }; Returns: WorkloadItemRow[] };
      can_manage_project: { Args: { p_project_id: string }; Returns: boolean };
      task_logged_minutes: { Args: { p_org_id: string }; Returns: { task_id: string; minutes: number }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
