import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LifecycleCompact } from "@/components/app/work-order-lifecycle";
import { ProgressBar } from "@/components/ui/motion";
import { formatMonth, formatRange, nextPeriod, type ISODate } from "@/lib/domain/periods";
import {
  formatMoney,
  workOrderAmounts,
  workOrderCode,
  type BillingStatus,
  type WorkOrderStatus,
} from "@/lib/domain/work-orders";
import type { WorkOrder } from "@/lib/supabase/database.types";
import { CopyNextButton } from "./copy-next-button";

export interface WorkOrderRowData {
  id: string;
  number: number;
  title: string;
  status: WorkOrderStatus;
  billing: BillingStatus;
  periodStart: ISODate;
  periodEnd: ISODate;
  budgetedHours: number | null;
  hourlyRate: number | null;
  loggedHours: number;
  taskCount: number;
  doneCount: number;
  /** Se muestra en el listado general; en el detalle de proyecto sobra */
  projectName?: string;
  clientName?: string | null;
  canCopy: boolean;
  /** OT que ya continúa a esta en el período siguiente (si existe) */
  continuationId?: string;
}

const fmtHours = (h: number) => `${Math.round(h * 10) / 10} h`;

/** Fila de OT compartida por el listado de órdenes y el detalle de proyecto. */
export function WorkOrderRow({ orgId, row }: { orgId: string; row: WorkOrderRowData }) {
  const amounts = workOrderAmounts({ budgetedHours: row.budgetedHours, loggedHours: row.loggedHours, hourlyRate: row.hourlyRate });
  const next = nextPeriod(row.periodStart, row.periodEnd);
  const meta = [workOrderCode(row.number), row.projectName, row.clientName, formatRange(row.periodStart, row.periodEnd)].filter(Boolean);
  const consumption = amounts.consumption ?? 0;

  return (
    <li className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/40 @3xl:grid-cols-[minmax(0,1.7fr)_7.5rem_minmax(0,1.1fr)_6.5rem_11.5rem] @3xl:items-center">
      <div className="order-1 col-span-2 min-w-0 @xl:col-span-1 @3xl:order-1">
        <Link
          href={`/app/${orgId}/work-orders/${row.id}`}
          className="block text-[14px] font-medium @xl:truncate after:absolute after:inset-0 after:content-[''] group-hover:text-accent"
        >
          {row.title}
        </Link>
        <p className="mt-0.5 text-[12px] text-muted-foreground @xl:truncate">
          {meta.map((m, i) => (
            <span key={i} className={i === 0 ? "font-mono" : undefined}>
              {i > 0 ? " · " : ""}
              {m}
            </span>
          ))}
        </p>
      </div>

      <div className="order-3 text-right @xl:order-2 @3xl:order-4">
        <p className="text-[14px] font-semibold tabular">{formatMoney(amounts.actualAmount)}</p>
        <p className="text-[11.5px] text-muted-foreground tabular">
          {amounts.budgetAmount !== null ? `presup. ${formatMoney(amounts.budgetAmount)}` : row.hourlyRate === null ? "sin tarifa" : "sin presupuesto"}
        </p>
      </div>

      <div className="order-2 @xl:order-3 @3xl:order-2">
        <LifecycleCompact status={row.status} billing={row.billing} />
      </div>

      {row.continuationId || row.canCopy ? (
        <div className="order-5 col-span-2 -ml-2.5 flex @xl:order-4 @xl:col-span-1 @xl:ml-0 @xl:items-end @xl:justify-end @3xl:order-5 @3xl:items-center">
        {row.continuationId ? (
          <Link
            href={`/app/${orgId}/work-orders/${row.continuationId}`}
            className="relative z-10 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12.5px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Sigue en {formatMonth(next.start)} <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <CopyNextButton
            orgId={orgId}
            workOrderId={row.id}
            targetLabel={formatMonth(next.start)}
            period={{ start: row.periodStart, end: row.periodEnd }}
          />
        )}
        </div>
      ) : null}

      <div className="order-4 col-span-2 @xl:order-5 @3xl:order-3 @3xl:col-span-1">
        <div className="mb-1.5 flex justify-between gap-2 text-[12px] text-muted-foreground">
          <span className="tabular">
            {row.budgetedHours !== null ? (
              <>
                <span className="text-foreground">{fmtHours(row.loggedHours)}</span> de {fmtHours(row.budgetedHours)}
              </>
            ) : (
              <>
                <span className="text-foreground">{fmtHours(row.loggedHours)}</span> imputadas
              </>
            )}
          </span>
          <span className="tabular">
            {row.doneCount}/{row.taskCount} tareas
          </span>
        </div>
        <ProgressBar
          value={row.budgetedHours ? row.loggedHours : 0}
          max={row.budgetedHours ?? 1}
          tone={consumption > 100 ? "danger" : consumption > 85 ? "warning" : "accent"}
        />
      </div>
    </li>
  );
}

export function WorkOrderList({ orgId, rows }: { orgId: string; rows: WorkOrderRowData[] }) {
  return (
    <ul className="@container overflow-hidden rounded-2xl border border-border bg-card">
      {/* Encabezados de columna (en pantallas anchas la lista se lee como una tabla) */}
      <li
        aria-hidden
        className="hidden border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase @3xl:grid @3xl:grid-cols-[minmax(0,1.7fr)_7.5rem_minmax(0,1.1fr)_6.5rem_11.5rem] @3xl:gap-x-6"
      >
        <span>Orden de trabajo</span>
        <span>Estado</span>
        <span>Horas y tareas</span>
        <span className="text-right">Importe</span>
        <span className="w-8" />
      </li>
      {rows.map((row) => (
        <WorkOrderRow key={row.id} orgId={orgId} row={row} />
      ))}
    </ul>
  );
}

/** Arma la fila a partir de la OT y sus tareas (minutos imputados por tarea). */
export function toWorkOrderRow(
  wo: WorkOrder,
  tasks: { work_order_id: string | null; id: string; status: string }[],
  minutes: Map<string, number>,
  extra: { projectName?: string; clientName?: string | null; canCopy: boolean; continuationId?: string },
): WorkOrderRowData {
  const own = tasks.filter((t) => t.work_order_id === wo.id);
  return {
    id: wo.id,
    number: wo.number,
    title: wo.title,
    status: wo.status,
    billing: wo.billing_status,
    periodStart: wo.period_start,
    periodEnd: wo.period_end,
    budgetedHours: wo.budgeted_hours === null ? null : Number(wo.budgeted_hours),
    hourlyRate: wo.hourly_rate === null ? null : Number(wo.hourly_rate),
    loggedHours: own.reduce((s, t) => s + (minutes.get(t.id) ?? 0), 0) / 60,
    taskCount: own.length,
    doneCount: own.filter((t) => t.status === "done").length,
    ...extra,
  };
}
