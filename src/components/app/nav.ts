import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/domain/permissions";

export type NavIcon = "dashboard" | "clock" | "calendar" | "projects" | "workOrders" | "planning" | "team" | "audit";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Si se define, solo se muestra con ese permiso */
  permission?: Permission;
  keywords?: string[];
}

export const NAV: NavItem[] = [
  { href: "dashboard", label: "Inicio", icon: "dashboard", keywords: ["resumen", "home"] },
  { href: "time-tracking", label: "Fichaje y horas", icon: "clock", keywords: ["fichar", "horas", "tiempo"] },
  { href: "projects", label: "Proyectos", icon: "projects", keywords: ["clientes", "presupuesto"] },
  { href: "work-orders", label: "Órdenes de trabajo", icon: "workOrders", keywords: ["ot", "mes", "facturación", "tareas"] },
  { href: "planning", label: "Planificación", icon: "planning", keywords: ["carga", "capacidad", "semanas", "recursos"] },
  { href: "vacations", label: "Vacaciones", icon: "calendar", keywords: ["ausencias", "días libres"] },
  { href: "employees", label: "Personas", icon: "team", keywords: ["equipo", "empleados", "departamentos", "organigrama", "invitar"] },
  { href: "audit", label: "Auditoría", icon: "audit", permission: "employees.manage", keywords: ["log", "historial"] },
];

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  clock: Clock3,
  calendar: CalendarDays,
  projects: FolderKanban,
  workOrders: ClipboardList,
  planning: CalendarRange,
  team: Users,
  audit: ScrollText,
};
