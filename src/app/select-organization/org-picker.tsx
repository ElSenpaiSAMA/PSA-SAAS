"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { isRole, ROLE_LABEL, type Role } from "@/lib/domain/permissions";
import { acceptInvitation } from "./actions";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface PendingInvitation {
  id: string;
  role_id: Role;
  position: string | null;
  organization: { id: string; name: string } | null;
}

interface MembershipItem {
  orgId: string;
  orgName: string;
  role: string;
  position: string | null;
}

function OrgMark({ name }: { name: string }) {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-gradient-to-b from-card to-muted text-[15px] font-semibold shadow-sm">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.06, duration: 0.7, ease: EASE } }),
};

export function OrgPicker({
  name,
  memberships,
  invitations,
  invitationError,
}: {
  name: string;
  memberships: MembershipItem[];
  invitations: PendingInvitation[];
  invitationError: boolean;
}) {
  let index = 0;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.035em]">
          Hola, <span className="font-serif font-normal italic">{name}</span>
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {memberships.length > 0 ? "Elegí con qué organización querés trabajar." : "Bienvenido a la intranet."}
        </p>
      </motion.div>

      {invitationError ? (
        <p className="mt-6 rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">
          No pudimos aceptar la invitación. Puede que ya haya sido usada.
        </p>
      ) : null}

      {invitations.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Invitaciones</h2>
          <div className="grid gap-2.5">
            {invitations.map((inv) => (
              <motion.form
                key={inv.id}
                custom={index++}
                variants={item}
                initial="hidden"
                animate="show"
                action={acceptInvitation.bind(null, inv.id)}
                className="flex items-center gap-4 rounded-2xl border border-accent/30 bg-accent-soft p-4"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Mail className="size-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{inv.organization?.name ?? "Organización"}</p>
                  <p className="text-[13px] text-muted-foreground">
                    Te invitaron como {ROLE_LABEL[inv.role_id].toLowerCase()}
                    {inv.position ? ` · ${inv.position}` : ""}
                  </p>
                </div>
                <SubmitButton size="sm" variant="accent" pendingLabel="Uniéndote…">
                  Aceptar
                </SubmitButton>
              </motion.form>
            ))}
          </div>
        </section>
      ) : null}

      {memberships.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Tus organizaciones</h2>
          <div className="grid gap-2.5">
            {memberships.map((m) => (
              <motion.div key={m.orgId} custom={index++} variants={item} initial="hidden" animate="show">
                <Link
                  href={`/app/${m.orgId}/dashboard`}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_12px_40px_-16px_rgb(0_0_0/0.25)]"
                >
                  <OrgMark name={m.orgName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.orgName}</p>
                    <p className="text-[13px] text-muted-foreground">{m.position ?? "Sin puesto asignado"}</p>
                  </div>
                  <Badge tone={m.role === "owner" || m.role === "admin" ? "accent" : "neutral"}>
                    {isRole(m.role) ? ROLE_LABEL[m.role] : m.role}
                  </Badge>
                  <ArrowRight className="size-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      ) : null}

      {memberships.length === 0 && invitations.length === 0 ? (
        <motion.div
          custom={index++}
          variants={item}
          initial="hidden"
          animate="show"
          className="mt-10 flex items-start gap-4 rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Lock className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-medium">Tu cuenta todavía no tiene acceso</p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              El acceso a la intranet lo da la administración de la empresa. Pedile a tu responsable que te invite desde Personas.
            </p>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
