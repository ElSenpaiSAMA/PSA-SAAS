import { Badge, type BadgeTone } from "@/components/ui/badge";
import { STATUS_LABEL, type BillingStatus, type WorkOrderStatus } from "@/lib/domain/work-orders";

const STATUS_TONE: Record<WorkOrderStatus, BadgeTone> = {
  draft: "neutral",
  approved: "accent",
  in_progress: "warning",
  closed: "success",
};

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function BillingBadge({ billing, status }: { billing: BillingStatus; status: WorkOrderStatus }) {
  if (billing === "invoiced") return <Badge tone="success">Facturada</Badge>;
  if (status === "closed") return <Badge tone="danger">Por facturar</Badge>;
  return null;
}
