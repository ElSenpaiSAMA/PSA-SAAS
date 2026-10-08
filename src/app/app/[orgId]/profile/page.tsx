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
import { Lock } from "lucide-react";
import { AvatarEditor, NotificationPrefs, ThemePreference } from "./profile-forms";
import { urlKey } from "@/lib/domain/slug";

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
        description="Tu foto y cómo querés ver la intranet. Tus datos y tus avisos los gestiona administración."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Foto de perfil" description="Así te ven tus compañeros en el foro, en Personas y en las tareas." />
            <CardBody>
              <AvatarEditor orgId={orgId} userId={ctx.userId} name={name} avatar={profile?.avatar_url ?? null} />
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
              description={
                ctx.can("platform.manage")
                  ? "Elegí qué te llega a la campana. Lo que necesita tu aprobación llega siempre."
                  : "Lo que te llega a la campana. Lo configura administración; lo que necesita tu aprobación llega siempre."
              }
              action={
                ctx.can("platform.manage") ? undefined : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] whitespace-nowrap text-muted-foreground">
                    <Lock className="size-3.5" /> Solo lectura
                  </span>
                )
              }
            />
            <CardBody>
              <NotificationPrefs orgId={orgId} editable={ctx.can("platform.manage")} muted={profile?.muted_notifications ?? []} permissions={PERMISSIONS.filter((p) => ctx.can(p))} />
            </CardBody>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-0">
          <CardHeader
            title="Tus datos"
            description="Los gestiona administración. Si algo está mal, avisá a RRHH."
            action={<Lock className="size-4 text-muted-foreground" aria-label="Solo lectura" />}
          />
          <CardBody className="pt-3">
            <dl className="divide-y divide-border">
              <Row label="Nombre">{name}</Row>
              <Row label="Email">
                <span className="break-all">{profile?.email ?? "—"}</span>
              </Row>
              <Row label="Rol">
                <Badge tone={ctx.role === "owner" || ctx.role === "director" ? "accent" : "neutral"}>{ROLE_LABEL[ctx.role]}</Badge>
              </Row>
              <Row label="Puesto">{me.position ?? "—"}</Row>
              <Row label="Departamento">{department?.name ?? "—"}</Row>
              <Row label="Responsable">{manager ? displayName(manager.profile) : "—"}</Row>
              <Row label="Jornada">{me.weekly_hours} h semanales</Row>
              <Row label="Vacaciones">{me.annual_vacation_days} días al año</Row>
              <Row label="En la empresa desde">{since}</Row>
            </dl>
            <Link
              href={`/app/staff/${urlKey(me)}`}
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
