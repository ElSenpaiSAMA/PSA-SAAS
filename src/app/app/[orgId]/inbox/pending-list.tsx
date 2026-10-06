"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CheckCheck, Clock3, FileCheck2, Palmtree, Receipt, SquareCheckBig, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/submit-button";
import { PENDING_LABEL, type PendingItem, type PendingKind } from "@/lib/domain/inbox";
import { cn } from "@/lib/utils";
import { decideVacation } from "../vacations/actions";

const ICON: Record<PendingKind, typeof Palmtree> = {
  vacation_approval: Palmtree,
  invoice: Receipt,
  close_work_order: FileCheck2,
  approve_work_order: FileCheck2,
  overdue_task: SquareCheckBig,
  open_clock: Clock3,
};

const TONE: Record<PendingKind, string> = {
  vacation_approval: "bg-success/12 text-success",
  invoice: "bg-accent-soft text-accent",
  close_work_order: "bg-accent-soft text-accent",
  approve_work_order: "bg-accent-soft text-accent",
  overdue_task: "bg-danger/12 text-danger",
  open_clock: "bg-warning/15 text-warning",
};

function VacationActions({ orgId, id }: { orgId: string; id: string }) {
  const [pending, start] = useTransition();
  const decide = (decision: "approved" | "rejected") =>
    start(async () => {
      const r = await decideVacation(orgId, id, decision);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });
  return (
    <div className="flex shrink-0 gap-1.5">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("rejected")} aria-label="Rechazar">
        <X className="size-3.5" /> Rechazar
      </Button>
      <Button size="sm" variant="primary" disabled={pending} onClick={() => decide("approved")}>
        {pending ? <Spinner /> : <Check className="size-3.5" />} Aprobar
      </Button>
    </div>
  );
}

export function PendingList({ orgId, items }: { orgId: string; items: PendingItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCheck}
        title="Nada pendiente"
        description="Cuando algo necesite tu acción (una aprobación, una OT por cerrar o facturar), aparece acá."
      />
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const Icon = ICON[item.kind];
          return (
            <motion.li
              key={item.key}
              layout
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5"
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", TONE[item.kind])}>
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                  <span className="truncate">{item.title}</span>
                  {item.urgent ? <Badge tone="danger">Urgente</Badge> : null}
                </p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  <span className="text-foreground/70">{PENDING_LABEL[item.kind]}</span> · {item.detail}
                </p>
              </div>
              {item.kind === "vacation_approval" ? (
                <VacationActions orgId={orgId} id={item.entityId} />
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Resolver <ArrowRight className="size-3.5" />
                </Link>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
