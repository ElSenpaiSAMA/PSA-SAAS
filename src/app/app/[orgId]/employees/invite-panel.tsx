"use client";

import { AnimatePresence, motion } from "motion/react";
import { Mail, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle, type ActionState } from "@/lib/actions";
import { outranks, ROLE_LABEL, ROLES, type Role } from "@/lib/domain/permissions";
import { inviteEmployee, revokeInvitation } from "./actions";

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  position: string | null;
  departmentName: string | null;
  createdAt: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  hasHead: boolean;
}

export function InvitePanel({
  orgId,
  myRole,
  managers,
  departments,
  pending,
}: {
  orgId: string;
  myRole: Role;
  managers: { id: string; name: string }[];
  departments: DepartmentOption[];
  pending: PendingInvite[];
}) {
  const [state, action] = useActionState(inviteEmployee.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);
  const roles = ROLES.filter((r) => r !== "owner" && (myRole === "owner" || outranks(myRole, r)));

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") toast.success(state.message);
    else if (!state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <div className="grid gap-6">
      <form key={state.status === "success" ? state.submittedAt : "draft"} action={action} noValidate className="grid gap-3">
        <InviteFields state={state} roles={roles} managers={managers} departments={departments} />
      </form>

      {pending.length > 0 ? (
        <div>
          <p className="mb-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Pendientes</p>
          <ul className="grid gap-2">
            <AnimatePresence initial={false}>
              {pending.map((p) => (
                <PendingRow key={p.id} orgId={orgId} invite={p} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function InviteFields({
  state,
  roles,
  managers,
  departments,
}: {
  state: ActionState;
  roles: Role[];
  managers: { id: string; name: string }[];
  departments: DepartmentOption[];
}) {
  const [departmentId, setDepartmentId] = useState("");
  // Con departamento (y responsable), el manager es el responsable
  const managedByHead = departments.find((d) => d.id === departmentId)?.hasHead ?? false;

  return (
    <>
      <Field label="Email" error={state.fieldErrors?.email}>
        <Input name="email" type="email" placeholder="nombre@empresa.com" />
      </Field>
      <Field label="Departamento" error={state.fieldErrors?.departmentId}>
        <Select name="departmentId" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Sin departamento</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rol" error={state.fieldErrors?.role}>
          <Select name="role" defaultValue="employee">
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        {managedByHead ? (
          <Field label="Reporta a" hint="Al responsable del departamento">
            <Input value="Responsable" disabled readOnly />
          </Field>
        ) : (
          <Field label="Reporta a" error={state.fieldErrors?.managerId}>
            <Select name="managerId" defaultValue="">
              <option value="">Nadie</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Puesto" error={state.fieldErrors?.position}>
        <Input name="position" placeholder="Ej: Product Designer" />
      </Field>
      <SubmitButton pendingLabel="Invitando…">
        <Mail className="size-4" /> Enviar invitación
      </SubmitButton>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        La persona verá la invitación al iniciar sesión con ese email y podrá aceptarla desde el selector de organización.
      </p>
    </>
  );
}

function PendingRow({ orgId, invite }: { orgId: string; invite: PendingInvite }) {
  const [pending, start] = useTransition();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong px-3 py-2.5"
    >
      <Mail className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{invite.email}</p>
        <p className="text-[12px] text-muted-foreground">
          {ROLE_LABEL[invite.role]}
          {invite.departmentName ? ` · ${invite.departmentName}` : ""}
          {invite.position ? ` · ${invite.position}` : ""}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        aria-label={`Revocar invitación a ${invite.email}`}
        onClick={() =>
          start(async () => {
            const r = await revokeInvitation(orgId, invite.id);
            if (r.status === "error") toast.error(r.message);
            else toast.success(r.message);
          })
        }
        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </motion.li>
  );
}
