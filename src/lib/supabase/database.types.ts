// Tipos de la base (mantener en sync con supabase/migrations).
// Con Supabase local se pueden regenerar con:
//   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts

import type { Permission, Role } from "@/lib/domain/permissions";
import type { VacationStatus } from "@/lib/domain/vacations";
import type { BillingStatus, WorkOrderStatus } from "@/lib/domain/work-orders";

type Timestamp = string;
type DateString = string;

export type TaskStatus = "todo" | "in_progress" | "done";
export type EntryType = "clock" | "break" | "task";
export type MembershipStatus = "active" | "inactive";
export type ProjectStatus = "active" | "archived";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  /** Avisos que la persona eligió no recibir (ver notification-prefs.ts) */
  muted_notifications: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Organization = {
  id: string;
  name: string;
  default_annual_vacation_days: number;
  default_weekly_hours: number;
  timezone: string;
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
  kind: "vacation" | "personal" | "sick" | "other";
  decision_note: string | null;
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

export type ContractType = "indefinido" | "temporal" | "practicas" | "freelance";

/** Versión de la ficha de empleado, vigente desde effective_from. */
export type EmployeeRecord = {
  id: string;
  org_id: string;
  membership_id: string;
  effective_from: DateString;
  national_id: string | null;
  birth_date: DateString | null;
  phone: string | null;
  personal_email: string | null;
  address: string | null;
  emergency_contact: string | null;
  hire_date: DateString | null;
  contract_type: ContractType | null;
  salary_annual: number | null;
  salary_currency: string;
  iban: string | null;
  notes: string | null;
  created_by: string | null;
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

export type TimeCorrection = {
  id: string;
  org_id: string;
  membership_id: string;
  entry_id: string | null;
  proposed_start: Timestamp;
  proposed_end: Timestamp;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decision_note: string | null;
  decided_by: string | null;
  decided_at: Timestamp | null;
  created_at: Timestamp;
};

export type NotificationKind =
  | "vacation.requested"
  | "vacation.decided"
  | "vacation.cancelled"
  | "task.assigned"
  | "project.added"
  | "work_order.to_invoice"
  | "vacation.escalated"
  | "clock.auto_closed"
  | "clock.reminder"
  | "work_order.budget"
  | "work_order.auto_closed"
  | "work_order.created"
  | "task.due_soon"
  | "task.overdue"
  | "team.weekly_summary"
  | "time.correction_requested"
  | "time.correction_decided"
  | "forum.reply"
  | "forum.notice"
  | "forum.mention"
  | "contact.received";

export type ForumCategory = "question" | "notice" | "incident";

export type ContactStatus = "new" | "in_progress" | "closed";

export type ContactMessage = {
  id: string;
  org_id: string;
  name: string;
  email: string;
  phone: string | null;
  boat_type: string;
  boat_model: string | null;
  service: string;
  message: string;
  status: ContactStatus;
  handled_by: string | null;
  handled_at: Timestamp | null;
  created_at: Timestamp;
};

export type ForumThread = {
  id: string;
  org_id: string;
  author_id: string | null;
  category: ForumCategory;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  resolved: boolean;
  reply_count: number;
  last_activity_at: Timestamp;
  last_author_id: string | null;
  mentions: string[];
  created_at: Timestamp;
  edited_at: Timestamp | null;
};

export type ForumPost = {
  id: string;
  thread_id: string;
  /** Respuesta a la que contesta (null = directa al hilo) */
  parent_id: string | null;
  org_id: string;
  author_id: string | null;
  body: string;
  mentions: string[];
  created_at: Timestamp;
  edited_at: Timestamp | null;
};

export type ForumRead = {
  membership_id: string;
  org_id: string;
  seen_at: Timestamp;
};

export type AutomationTemplate = {
  key: string;
  trigger_kind: "event" | "schedule";
  default_enabled: boolean;
  default_params: Record<string, unknown>;
};

export type AutomationRule = {
  org_id: string;
  key: string;
  enabled: boolean;
  params: Record<string, unknown>;
  updated_by: string | null;
  updated_at: Timestamp;
};

export type AutomationRun = {
  id: number;
  org_id: string;
  rule_key: string;
  dedupe_key: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: string | null;
  created_at: Timestamp;
};

export type Notification = {
  id: string;
  org_id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: NotificationKind | (string & {});
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: Timestamp | null;
  created_at: Timestamp;
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
      employee_records: Table<EmployeeRecord, "membership_id" | "effective_from">;
      notifications: Table<Notification, "org_id" | "recipient_id" | "kind" | "title">;
      time_corrections: Table<TimeCorrection, "membership_id" | "proposed_start" | "proposed_end" | "reason">;
      automation_templates: Table<AutomationTemplate, "key" | "trigger_kind" | "default_enabled">;
      automation_rules: Table<AutomationRule, "org_id" | "key" | "enabled">;
      automation_runs: Table<AutomationRun, "org_id" | "rule_key" | "dedupe_key">;
      forum_threads: Table<ForumThread, "author_id" | "category" | "title" | "body">;
      forum_posts: Table<ForumPost, "thread_id" | "author_id" | "body">;
      contact_messages: Table<ContactMessage, "org_id" | "name" | "email" | "boat_type" | "service" | "message">;
      forum_reads: Table<ForumRead, "membership_id">;
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
      clock_pause: { Args: { p_org_id: string }; Returns: undefined };
      vacation_approvers: { Args: { p_membership_id: string }; Returns: string[] };
      run_automation_now: { Args: { p_org_id: string; p_key: string }; Returns: number };
      clock_resume: { Args: { p_org_id: string }; Returns: undefined };
      workload_items: { Args: { p_org_id: string; p_from: string; p_to: string }; Returns: WorkloadItemRow[] };
      can_manage_project: { Args: { p_project_id: string }; Returns: boolean };
      task_logged_minutes: { Args: { p_org_id: string }; Returns: { task_id: string; minutes: number }[] };
      forum_unread_count: { Args: { p_org_id: string }; Returns: number };
      contact_new_count: { Args: { p_org_id: string }; Returns: number };
      submit_contact_message: {
        Args: {
          p_name: string;
          p_email: string;
          p_phone: string | null;
          p_boat_type: string;
          p_boat_model: string | null;
          p_service: string;
          p_message: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
