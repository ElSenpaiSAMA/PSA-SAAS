"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Network, Pencil, Rows3, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import { reportsOf } from "@/lib/domain/hierarchy";
import { outranks, ROLE_LABEL, ROLES, type Role } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";
import { updateMember } from "./actions";
import { DepartmentsView, type DepartmentInfo } from "./departments-view";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface Person {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
  role: Role;
  position: string | null;
  managerId: string | null;
  departmentId: string | null;
  weeklyHours: number;
  isMe: boolean;
}

function roleTone(role: Role) {
  return role === "owner" || role === "admin" ? "accent" : role === "manager" ? "success" : "neutral";
}

function EditMember({
  orgId,
  person,
  people,
  myRole,
  departments,
  onDone,
}: {
  orgId: string;
  person: Person;
  people: Person[];
  myRole: Role;
  departments: DepartmentInfo[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateMember.bind(null, orgId), idle);
  const handled = useRef<number | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState(person.departmentId ?? "");
  const department = departments.find((d) => d.id === departmentId);
  // Con departamento, el manager es su responsable (lo asigna la base)
  const managedByHead = !!department?.headId && department.headId !== person.id;

  useEffect(() => {
    if (!state.submittedAt || handled.current === state.submittedAt) return;
    handled.current = state.submittedAt;
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onDone]);

  // Ni uno mismo ni nadie de su propia línea de reporte puede ser su manager (evita ciclos)
  const blocked = reportsOf(people.map((p) => ({ id: p.id, manager_id: p.managerId })), person.id);
  const managers = people.filter((p) => p.id !== person.id && !blocked.has(p.id));
  const roles = ROLES.filter((r) => r !== "owner" && (myRole === "owner" || outranks(myRole, r)));

  return (
    <motion.form
      action={action}
      noValidate
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="overflow-hidden"
    >
      <input type="hidden" name="membershipId" value={person.id} />
      <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <Field label="Rol" error={state.fieldErrors?.role}>
          <Select name="role" defaultValue={person.role}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
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
        <Field
          label="Reporta a"
          error={state.fieldErrors?.managerId}
          hint={managedByHead ? `Lo define el responsable de ${department?.name}` : undefined}
        >
          {managedByHead ? (
            <Select key="head" name="managerId" value={department?.headId ?? ""} onChange={() => {}} aria-readonly className="pointer-events-none opacity-70">
              <option value={department?.headId ?? ""}>
                {people.find((p) => p.id === department?.headId)?.name ?? "Responsable"}
              </option>
            </Select>
          ) : (
            <Select key="manual" name="managerId" defaultValue={person.managerId ?? ""}>
              <option value="">Nadie</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Puesto" error={state.fieldErrors?.position}>
          <Input name="position" defaultValue={person.position ?? ""} />
        </Field>
        <Field label="Horas semanales" error={state.fieldErrors?.weeklyHours}>
          <Input name="weeklyHours" type="number" min="1" max="60" defaultValue={person.weeklyHours} />
        </Field>
        <div className="flex items-end justify-end gap-2">
          <button type="button" onClick={onDone} className="h-10 rounded-xl px-4 text-sm text-muted-foreground hover:bg-muted">
            Cancelar
          </button>
          <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
        </div>
      </div>
    </motion.form>
  );
}

function Directory({
  orgId,
  people,
  allPeople,
  myRole,
  canManage,
  departments,
}: {
  orgId: string;
  people: Person[];
  allPeople: Person[];
  myRole: Role;
  canManage: boolean;
  departments: DepartmentInfo[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const names = new Map(allPeople.map((p) => [p.id, p.name]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  const heads = new Set(departments.map((d) => d.headId).filter(Boolean));

  if (people.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">No hay personas que coincidan con el filtro.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {people.map((p, i) => {
        const editable = canManage && !p.isMe && (myRole === "owner" || outranks(myRole, p.role));
        const open = editing === p.id;
        return (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.6, ease: EASE }}
            className={cn("rounded-2xl border bg-card p-4 transition-colors", open ? "border-accent/40 md:col-span-2" : "border-border")}
          >
            <div className="flex items-center gap-3.5">
              <Avatar name={p.name} src={p.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  <Link href={`/app/${orgId}/staff/${p.id}`} className="transition-colors hover:text-accent hover:underline">
                    {p.name}
                  </Link>{" "}
                  {p.isMe ? <span className="text-[12px] font-normal text-muted-foreground">(vos)</span> : null}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {p.position ?? "Sin puesto"}
                  {p.managerId ? ` · reporta a ${names.get(p.managerId) ?? "—"}` : ""}
                </p>
                {p.departmentId ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Building2 className="size-3" strokeWidth={1.75} />
                    {departmentName.get(p.departmentId)}
                    {heads.has(p.id) ? <span className="font-medium text-accent"> · Responsable</span> : null}
                  </p>
                ) : null}
              </div>
              <Badge tone={roleTone(p.role)}>{ROLE_LABEL[p.role]}</Badge>
              {editable ? (
                <button
                  type="button"
                  onClick={() => setEditing(open ? null : p.id)}
                  aria-label={open ? "Cerrar edición" : `Editar a ${p.name}`}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {open ? <X className="size-4" /> : <Pencil className="size-4" strokeWidth={1.75} />}
                </button>
              ) : null}
            </div>
            <AnimatePresence>
              {open ? (
                <EditMember
                  orgId={orgId}
                  person={p}
                  people={allPeople}
                  myRole={myRole}
                  departments={departments}
                  onDone={() => setEditing(null)}
                />
              ) : null}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function OrgNode({
  person,
  childrenOf,
  depth,
  className,
}: {
  person: Person;
  childrenOf: Map<string | null, Person[]>;
  depth: number;
  className?: string;
}) {
  const kids = childrenOf.get(person.id) ?? [];
  return (
    <li className={cn("relative", className)}>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.08, duration: 0.5, ease: EASE }}
        className={cn(
          "relative inline-flex items-center gap-3 rounded-xl border bg-card py-2 pr-4 pl-2",
          person.isMe ? "border-accent/40 ring-4 ring-accent-soft" : "border-border",
        )}
      >
        <Avatar name={person.name} src={person.avatar} size={32} />
        <div>
          <p className="text-[13.5px] leading-tight font-medium">{person.name}</p>
          <p className="text-[12px] text-muted-foreground">{person.position ?? ROLE_LABEL[person.role]}</p>
        </div>
      </motion.div>
      {kids.length ? (
        <ul className="relative mt-2 ml-5 grid gap-2 border-l border-border-strong pl-6">
          {kids.map((k) => (
            <OrgNode
              key={k.id}
              person={k}
              childrenOf={childrenOf}
              depth={depth + 1}
              className="before:absolute before:top-6 before:-left-6 before:h-px before:w-5 before:bg-border-strong"
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OrgChart({ people }: { people: Person[] }) {
  const childrenOf = useMemo(() => {
    const ids = new Set(people.map((p) => p.id));
    const map = new Map<string | null, Person[]>();
    for (const p of people) {
      const parent = p.managerId && ids.has(p.managerId) ? p.managerId : null;
      map.set(parent, [...(map.get(parent) ?? []), p]);
    }
    return map;
  }, [people]);

  return (
    <ul className="grid gap-3 overflow-x-auto rounded-2xl border border-border bg-muted/30 p-6">
      {(childrenOf.get(null) ?? []).map((root) => (
        <OrgNode key={root.id} person={root} childrenOf={childrenOf} depth={0} />
      ))}
    </ul>
  );
}

type View = "directory" | "departments" | "chart";

const TABS: { id: View; label: string; icon: typeof Rows3 }[] = [
  { id: "directory", label: "Directorio", icon: Rows3 },
  { id: "departments", label: "Departamentos", icon: Building2 },
  { id: "chart", label: "Organigrama", icon: Network },
];

export function TeamView({
  orgId,
  people,
  myRole,
  canManage,
  canManageDepartments,
  departments,
}: {
  orgId: string;
  people: Person[];
  myRole: Role;
  canManage: boolean;
  canManageDepartments: boolean;
  departments: DepartmentInfo[];
}) {
  const [view, setView] = useState<View>("directory");
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const filtered = people.filter(
    (p) =>
      (departmentFilter === "all" ||
        (departmentFilter === "none" ? !p.departmentId : p.departmentId === departmentFilter)) &&
      `${p.name} ${p.email ?? ""} ${p.position ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative inline-flex rounded-xl border border-border bg-card p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={view === t.id}
              onClick={() => setView(t.id)}
              className={cn(
                "relative inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] transition-colors",
                view === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {view === t.id ? (
                <motion.span
                  layoutId="team-tab"
                  className="absolute inset-0 rounded-lg bg-muted"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <t.icon className="relative size-4" strokeWidth={1.75} />
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        {view === "directory" ? (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, email o puesto…"
              className="h-10 max-w-xs"
              aria-label="Buscar personas"
            />
            {departments.length > 0 ? (
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="h-10 w-56"
                aria-label="Filtrar por departamento"
              >
                <option value="all">Todos los departamentos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="none">Sin departamento</option>
              </Select>
            ) : null}
          </>
        ) : null}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {view === "directory" ? (
            <Directory
              orgId={orgId}
              people={filtered}
              allPeople={people}
              myRole={myRole}
              canManage={canManage}
              departments={departments}
            />
          ) : view === "departments" ? (
            <DepartmentsView orgId={orgId} departments={departments} people={people} canManage={canManageDepartments} />
          ) : (
            <OrgChart people={people} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
