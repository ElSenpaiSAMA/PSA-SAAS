"use client";

import { Check, ChevronDown, CircleCheck, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/domain/audit";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { setErrorResolved } from "./actions";

export interface ErrorItem {
  id: string;
  createdAt: string;
  source: "server" | "action" | "client" | "data";
  message: string;
  digest: string | null;
  stack: string | null;
  path: string | null;
  context: Record<string, unknown>;
  resolved: boolean;
}

const SOURCE: Record<ErrorItem["source"], { label: string; tone: BadgeTone }> = {
  server: { label: "Servidor", tone: "danger" },
  action: { label: "Acción", tone: "warning" },
  client: { label: "Navegador", tone: "accent" },
  data: { label: "Datos", tone: "neutral" },
};

export function ErrorList({ orgId, items, emptyText }: { orgId: string; items: ErrorItem[]; emptyText: string }) {
  const now = useNow();
  const [open, setOpen] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <CircleCheck className="size-8 text-success" strokeWidth={1.5} />
        <p className="text-[14px] text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((e) => {
        const expanded = open === e.id;
        return (
          <li key={e.id} className={cn(e.resolved && "opacity-60")}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : e.id)}
              aria-expanded={expanded}
              className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
            >
              <Badge tone={SOURCE[e.source].tone}>{SOURCE[e.source].label}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[13px]">{e.message}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{e.path ?? "—"}</span>
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground">{now ? relativeTime(e.createdAt, now) : ""}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded ? <ErrorDetail orgId={orgId} item={e} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function ErrorDetail({ orgId, item }: { orgId: string; item: ErrorItem }) {
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const r = await setErrorResolved(orgId, item.id, !item.resolved);
      if (r.status === "error") toast.error(r.message);
      else toast.success(r.message);
    });
  const context = Object.entries(item.context ?? {});

  return (
    <div className="grid gap-3 border-t border-border bg-muted/30 px-5 py-4">
      <p className="font-mono text-[13px] break-words whitespace-pre-wrap">{item.message}</p>
      <dl className="grid gap-1 text-[12.5px] sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">Ruta</dt>
        <dd className="font-mono break-all">{item.path ?? "—"}</dd>
        {item.digest ? (
          <>
            <dt className="text-muted-foreground">Código (digest)</dt>
            <dd className="font-mono">{item.digest}</dd>
          </>
        ) : null}
        {context.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono break-all">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
          </div>
        ))}
      </dl>
      {item.stack ? (
        <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-card p-3 font-mono text-[11.5px] leading-relaxed">{item.stack}</pre>
      ) : null}
      <div>
        <Button size="sm" variant="secondary" disabled={pending} onClick={toggle}>
          {item.resolved ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
          {item.resolved ? "Reabrir" : "Marcar como resuelto"}
        </Button>
      </div>
    </div>
  );
}
