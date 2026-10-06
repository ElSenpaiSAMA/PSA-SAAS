import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock3,
  FolderKanban,
  Inbox,
  IdCard,
  LayoutDashboard,
  Palmtree,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/domain/permissions";

export type NavIcon = "dashboard" | "inbox" | "clock" | "calendar" | "vacations" | "projects" | "workOrders" | "planning" | "team" | "staff" | "audit";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Si se define, solo se muestra con ese permiso */
  permission?: Permission;
  keywords?: string[];
  /** Muestra un contador (p. ej. pendientes de la bandeja) */
  badge?: "inbox";
}

export const NAV: NavItem[] = [
  { href: "dashboard", label: "Inicio", icon: "dashboard", keywords: ["resumen", "home"] },
  { href: "inbox", label: "Bandeja", icon: "inbox", badge: "inbox", keywords: ["pendientes", "notificaciones", "avisos", "aprobar"] },
  { href: "time-tracking", label: "Fichaje y horas", icon: "clock", keywords: ["fichar", "horas", "tiempo"] },
  { href: "calendar", label: "Calendario", icon: "calendar", keywords: ["agenda", "festivos", "vencimientos", "ausencias"] },
  { href: "projects", label: "Proyectos", icon: "projects", keywords: ["clientes", "presupuesto"] },
  { href: "work-orders", label: "Órdenes de trabajo", icon: "workOrders", keywords: ["ot", "mes", "facturación", "tareas"] },
  { href: "planning", label: "Planificación", icon: "planning", keywords: ["carga", "capacidad", "semanas", "recursos"] },
  { href: "vacations", label: "Vacaciones", icon: "vacations", keywords: ["ausencias", "días libres"] },
  { href: "staff", label: "Empleados", icon: "staff", keywords: ["perfil", "ficha", "dni", "sueldo", "contrato", "rrhh"] },
  { href: "employees", label: "Personas", icon: "team", keywords: ["equipo", "departamentos", "organigrama", "invitar"] },
  { href: "audit", label: "Auditoría", icon: "audit", permission: "employees.manage", keywords: ["log", "historial"] },
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
  audit: ScrollText,
};
