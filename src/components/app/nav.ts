import { CalendarDays, Clock3, FolderKanban, LayoutDashboard, ScrollText, Users, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/domain/permissions";

export type NavIcon = "dashboard" | "clock" | "calendar" | "projects" | "team" | "audit";

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
  { href: "vacations", label: "Vacaciones", icon: "calendar", keywords: ["ausencias", "días libres"] },
  { href: "projects", label: "Proyectos", icon: "projects", keywords: ["tareas", "presupuesto"] },
  { href: "employees", label: "Personas", icon: "team", keywords: ["equipo", "empleados", "departamentos", "organigrama", "invitar"] },
  { href: "audit", label: "Auditoría", icon: "audit", permission: "employees.manage", keywords: ["log", "historial"] },
];

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  clock: Clock3,
  calendar: CalendarDays,
  projects: FolderKanban,
  team: Users,
  audit: ScrollText,
};
