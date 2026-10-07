"use client";

import { AnimatePresence, motion } from "motion/react";
import { UserPlus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { PROJECT_ROLE_HINT, PROJECT_ROLE_LABEL, type ProjectRole } from "@/lib/domain/permissions";
import { addProjectMember, removeProjectMember } from "../actions";

export interface Member {
  id: string;
  name: string;
  avatar: string | null;
  position: string | null;
  role: ProjectRole;
  isMe: boolean;
}

const ROLE_TONE = { lead: "accent", member: "neutral", observer: "warning" } as const;

interface Candidate {
  id: string;
  name: string;
  sameDepartment: boolean;
}

export function MembersPanel({
  orgId,
  projectId,
  members,
  candidates,
  canManage,
  canAppointLead,
}: {
  orgId: string;
  projectId: string;
  members: Member[];
  candidates: Candidate[];
  canManage: boolean;
  /** Nombrar responsables queda para quien gestiona por encima del proyecto */
  canAppointLead: boolean;
}) {
  const [state, action] = useActionState(addProjectMember.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  const ownDepartment = candidates.filter((c) => c.sameDepartment);
  const others = candidates.filter((c) => !c.sameDepartment);

  return (
    <div className="grid gap-4">
      {canManage && candidates.length > 0 ? (
        <form key={state.status === "success" ? state.submittedAt : "draft"} action={action} className="grid gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <div className="flex gap-2">
          <Select name="membershipId" defaultValue="" aria-label="Persona a invitar" className="h-10">
            <option value="" disabled>
              Invitar a alguien…
            </option>
            {ownDepartment.length > 0 ? (
              <optgroup label="Del departamento">
                {ownDepartment.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {others.length > 0 ? (
              <optgroup label={ownDepartment.length > 0 ? "Otras áreas" : "Personas"}>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
          <SubmitButton size="icon" aria-label="Invitar al proyecto" className="h-10 w-10 shrink-0">
            <UserPlus className="size-4" />
          </SubmitButton>
          </div>
          <Select name="role" defaultValue="member" aria-label="Rol en el proyecto" className="h-9 text-[13px]">
            {(canAppointLead ? (["member", "observer", "lead"] as const) : (["member", "observer"] as const)).map((r) => (
              <option key={r} value={r}>
                {PROJECT_ROLE_LABEL[r]}: {PROJECT_ROLE_HINT[r].toLowerCase()}
              </option>
            ))}
          </Select>
        </form>
      ) : null}

      {members.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Todavía no hay miembros.</p>
      ) : (
        <ul className="grid gap-1">
          <AnimatePresence initial={false}>
            {members.map((m) => (
              <motion.li
                key={m.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="group flex items-center gap-3 rounded-xl px-1 py-1.5"
              >
                <Avatar name={m.name} src={m.avatar} size={30} className="ring-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">
                    {m.name} {m.isMe ? <span className="font-normal text-muted-foreground">(vos)</span> : null}
                  </p>
                  {m.position ? <p className="truncate text-[12px] text-muted-foreground">{m.position}</p> : null}
                </div>
                <Badge tone={ROLE_TONE[m.role]} title={PROJECT_ROLE_HINT[m.role]}>
                  {PROJECT_ROLE_LABEL[m.role]}
                </Badge>
                {canManage ? <RemoveMember orgId={orgId} projectId={projectId} member={m} /> : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function RemoveMember({ orgId, projectId, member }: { orgId: string; projectId: string; member: Member }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Quitar a ${member.name} del proyecto`}
      onClick={() =>
        start(async () => {
          const r = await removeProjectMember(orgId, projectId, member.id);
          if (r.status === "error") toast.error(r.message);
          else toast.success(r.message);
        })
      }
      className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 disabled:opacity-50"
    >
      <X className="size-4" />
    </button>
  );
}
