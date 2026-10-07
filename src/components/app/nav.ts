import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock3,
  FolderKanban,
  Inbox,
  IdCard,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Palmtree,
  Settings,
  ScrollText,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/domain/permissions";

export type NavIcon = "dashboard" | "inbox" | "clock" | "calendar" | "vacations" | "projects" | "workOrders" | "planning" | "team" | "staff" | "automations" | "audit" | "settings" | "reports" | "forum" | "contact";

export type NavGroup = "Mi día" | "Trabajo" | "Personas" | "Gestión";

export const NAV_GROUPS: NavGroup[] = ["Mi día", "Trabajo", "Personas", "Gestión"];

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Si se define, solo se muestra con ese permiso */
  permission?: Permission;
  keywords?: string[];
  /** Sección de la barra lateral */
  group: NavGroup;
  /** Muestra un contador (p. ej. pendientes de la bandeja) */
  badge?: "inbox" | "forum" | "contact";
}

export const NAV: NavItem[] = [
  { href: "dashboard", group: "Mi día", label: "Inicio", icon: "dashboard", keywords: ["resumen", "home"] },
  { href: "inbox", group: "Mi día", label: "Bandeja", icon: "inbox", badge: "inbox", keywords: ["pendientes", "notificaciones", "avisos", "aprobar"] },
  { href: "time-tracking", group: "Mi día", label: "Fichaje y horas", icon: "clock", keywords: ["fichar", "horas", "tiempo"] },
  { href: "calendar", group: "Mi día", label: "Calendario", icon: "calendar", keywords: ["agenda", "festivos", "vencimientos", "ausencias"] },
  { href: "forum", group: "Mi día", label: "Foro", icon: "forum", badge: "forum", keywords: ["dudas", "avisos", "incidencias", "hilos", "comunidad", "preguntas"] },
  { href: "projects", group: "Trabajo", label: "Proyectos", icon: "projects", keywords: ["clientes", "presupuesto"] },
  { href: "work-orders", group: "Trabajo", label: "Órdenes de trabajo", icon: "workOrders", keywords: ["ot", "mes", "facturación", "tareas"] },
  { href: "contact", group: "Trabajo", label: "Mensajes web", icon: "contact", badge: "contact", permission: "contact.manage", keywords: ["contacto", "consultas", "clientes", "presupuestos", "formulario", "leads"] },
  { href: "planning", group: "Trabajo", label: "Planificación", icon: "planning", keywords: ["carga", "capacidad", "semanas", "recursos"] },
  { href: "vacations", group: "Personas", label: "Vacaciones", icon: "vacations", keywords: ["ausencias", "días libres"] },
  { href: "staff", group: "Personas", label: "Empleados", icon: "staff", keywords: ["perfil", "ficha", "dni", "sueldo", "contrato", "rrhh"] },
  { href: "employees", group: "Personas", label: "Personas", icon: "team", keywords: ["equipo", "departamentos", "organigrama", "invitar"] },
  { href: "reports", group: "Gestión", label: "Informes", icon: "reports", permission: "time.view_team", keywords: ["excel", "csv", "exportar", "facturación", "horas", "ausencias"] },
  { href: "automations", group: "Gestión", label: "Automatizaciones", icon: "automations", permission: "automations.manage", keywords: ["reglas", "workflows", "flujos", "recordatorios", "automático"] },
  { href: "settings", group: "Gestión", label: "Ajustes", icon: "settings", permission: "employees.manage", keywords: ["configuración", "empresa", "zona horaria", "roles", "permisos"] },
  { href: "audit", group: "Gestión", label: "Auditoría", icon: "audit", permission: "employees.manage", keywords: ["log", "historial"] },
];

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  clock: Clock3,
  calendar: CalendarDays,
  vacations: Palmtree,
  projects: FolderKanban,
  workOrders: ClipboardList,
  planning: CalendarRange,
  team: Users,
  staff: IdCard,
  automations: Workflow,
  audit: ScrollText,
  settings: Settings,
  reports: BarChart3,
  forum: MessagesSquare,
  contact: Mail,
};
