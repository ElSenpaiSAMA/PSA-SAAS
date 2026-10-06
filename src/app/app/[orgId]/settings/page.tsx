import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, Check, ScrollText, Workflow } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requirePermission } from "@/lib/data/session";
import { ROLE_LABEL, ROLES } from "@/lib/domain/permissions";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage({ params }: PageProps<"/app/[orgId]/settings">) {
  const { orgId } = await params;
  const ctx = await requirePermission(orgId, "employees.manage");
  const org = ctx.organization;

  // Catálogo de permisos y su asignación por rol: se lee de la base, que es la fuente de verdad
  const supabase = await createClient();
  const [{ data: permissions }, { data: grants }] = await Promise.all([
    supabase.from("permissions").select("key, description").order("key"),
    supabase.from("role_permissions").select("role_id, permission_key"),
  ]);
  const granted = new Set((grants ?? []).map((g) => `${g.role_id}:${g.permission_key}`));

  const links = [
    {
      href: `/app/${orgId}/calendar`,
      icon: CalendarDays,
      title: "Festivos",
      text: "Se cargan desde el calendario y no cuentan como días de vacaciones.",
    },
    {
      href: `/app/${orgId}/employees`,
      icon: Building2,
      title: "Departamentos y personas",
      text: "Responsables, organigrama, invitaciones y jornada de cada persona.",
    },
    {
      href: `/app/${orgId}/automations`,
      icon: Workflow,
      title: "Automatizaciones",
      text: "Recordatorios, cierres y aprobaciones automáticas.",
    },
    { href: `/app/${orgId}/audit`, icon: ScrollText, title: "Auditoría", text: "Quién hizo qué y cuándo." },
  ];

  return (
    <>
      <PageHeader title="Ajustes" description={`Configuración de ${org.name}.`} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader title="Empresa" description="Nombre, zona horaria y valores por defecto" />
          <CardBody>
            <SettingsForm
              orgId={orgId}
              values={{
                name: org.name,
                timezone: org.timezone,
                defaultAnnualVacationDays: Number(org.default_annual_vacation_days),
                defaultWeeklyHours: Number(org.default_weekly_hours),
              }}
            />
          </CardBody>
        </Card>

        <div className="grid gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                <l.icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{l.title}</span>
                <span className="block text-[12.5px] text-muted-foreground">{l.text}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Qué puede hacer cada rol" description="El rol de cada persona se cambia desde Personas" />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Permiso</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-3 py-2 text-center font-medium">
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(permissions ?? []).map((p) => (
                  <tr key={p.key} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-4">{p.description}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-3 py-2.5 text-center">
                        {granted.has(`${r}:${p.key}`) ? (
                          <Check className="mx-auto size-4 text-success" aria-label="Sí" />
                        ) : (
                          <span className="text-muted-foreground/50" aria-label="No">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Además, todas las personas fichan, imputan horas, piden ausencias y ven sus propios datos.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
