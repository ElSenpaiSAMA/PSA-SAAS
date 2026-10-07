import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getDepartments } from "@/lib/data/departments";
import { getEmployees } from "@/lib/data/employees";
import { getOrgContext, getProfile } from "@/lib/data/session";
import { displayName } from "@/lib/domain/hierarchy";
import { PERMISSIONS, ROLE_LABEL } from "@/lib/domain/permissions";
import { AvatarEditor, NameForm, NotificationPrefs, ThemePreference } from "./profile-forms";

export const metadata: Metadata = { title: "Mi perfil" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-[13.5px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function ProfilePage({ params }: PageProps<"/app/[orgId]/profile">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const [profile, employees, departments] = await Promise.all([getProfile(ctx.userId), getEmployees(orgId), getDepartments(orgId)]);

  const me = ctx.membership;
  const name = displayName(profile ? { full_name: profile.full_name, email: profile.email } : null);
  const manager = employees.find((e) => e.id === me.manager_id);
  const department = departments.find((d) => d.id === me.department_id);
  const since = new Date(me.created_at).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: ctx.organization.timezone,
  });

  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Tu foto, tu nombre y cómo querés usar la intranet. Lo ven tus compañeros en el foro y en Personas."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Foto y nombre" description="Así te ven en el foro, en Personas y en las tareas." />
            <CardBody className="grid gap-6">
              <AvatarEditor orgId={orgId} userId={ctx.userId} name={name} avatar={profile?.avatar_url ?? null} />
              <NameForm orgId={orgId} fullName={profile?.full_name ?? ""} email={profile?.email ?? ""} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Apariencia" description="Se guarda en este navegador." />
            <CardBody>
              <ThemePreference />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Avisos"
              description="Elegí qué te llega a la campana. Lo que necesita tu aprobación (vacaciones, correcciones de fichaje) llega siempre."
            />
            <CardBody>
              <NotificationPrefs
                orgId={orgId}
                muted={profile?.muted_notifications ?? []}
                permissions={PERMISSIONS.filter((p) => ctx.can(p))}
              />
            </CardBody>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-0">
          <CardHeader title="Tu puesto" description="Lo define administración." />
          <CardBody className="pt-3">
            <dl className="divide-y divide-border">
              <Row label="Rol">
                <Badge tone={ctx.role === "owner" || ctx.role === "admin" ? "accent" : "neutral"}>{ROLE_LABEL[ctx.role]}</Badge>
              </Row>
              <Row label="Puesto">{me.position ?? "—"}</Row>
              <Row label="Departamento">{department?.name ?? "—"}</Row>
              <Row label="Responsable">{manager ? displayName(manager.profile) : "—"}</Row>
              <Row label="Jornada">{me.weekly_hours} h semanales</Row>
              <Row label="Vacaciones">{me.annual_vacation_days} días al año</Row>
              <Row label="En la empresa desde">{since}</Row>
            </dl>
            <Link
              href={`/app/${orgId}/staff/${me.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
            >
              Ver mi ficha completa <ArrowRight className="size-3.5" />
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
