"use client";

import { useRouter } from "next/navigation";
import {
  AlarmClock,
  AtSign,
  BarChart3,
  BellOff,
  CheckCheck,
  Clock3,
  FileCheck2,
  FolderKanban,
  Gauge,
  Megaphone,
  MessagesSquare,
  Palmtree,
  SquareCheckBig,
  type LucideIcon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeTime } from "@/lib/domain/audit";
import type { Notification } from "@/lib/supabase/database.types";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { markAllRead, openNotification } from "./actions";

const ICON: Record<string, LucideIcon> = {
  "vacation.requested": Palmtree,
  "vacation.decided": Palmtree,
  "vacation.cancelled": Palmtree,
  "task.assigned": SquareCheckBig,
  "project.added": FolderKanban,
  "work_order.to_invoice": FileCheck2,
  "vacation.escalated": Palmtree,
  "clock.auto_closed": Clock3,
  "clock.reminder": AlarmClock,
  "work_order.budget": Gauge,
  "work_order.auto_closed": FileCheck2,
  "work_order.created": FileCheck2,
  "task.due_soon": SquareCheckBig,
  "task.overdue": SquareCheckBig,
  "team.weekly_summary": BarChart3,
  "time.correction_requested": Clock3,
  "time.correction_decided": Clock3,
  "forum.reply": MessagesSquare,
  "forum.notice": Megaphone,
  "forum.mention": AtSign,
};

export function NotificationList({ orgId, items }: { orgId: string; items: Notification[] }) {
  const router = useRouter();
  const now = useNow();
  const [pending, start] = useTransition();
  const unread = items.filter((n) => !n.read_at).length;

  const open = (n: Notification) =>
    start(async () => {
      const { link } = await openNotification(orgId, n.id);
      if (link) router.push(link);
    });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="Sin notificaciones"
        description="Te avisamos acá cuando te asignen tareas, decidan tus vacaciones o haya algo para vos."
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted-foreground">{unread ? `${unread} sin leer` : "Todo leído"}</p>
        {unread ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await markAllRead(orgId);
                if (r.status === "error") toast.error(r.message);
              })
            }
          >
            <CheckCheck className="size-3.5" /> Marcar todo como leído
          </Button>
        ) : null}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((n) => {
          const Icon = ICON[n.kind] ?? Palmtree;
          return (
            <li key={n.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  !n.read_at && "bg-accent-soft/40",
                )}
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13.5px]", !n.read_at && "font-medium")}>{n.title}</span>
                  {n.body ? <span className="block truncate text-[12.5px] text-muted-foreground">{n.body}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5 text-[11.5px] text-muted-foreground">
                  {now ? relativeTime(n.created_at, now) : ""}
                  {!n.read_at ? <span className="size-2 rounded-full bg-accent" aria-label="Sin leer" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
