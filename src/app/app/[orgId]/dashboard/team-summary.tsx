"use client";

import { motion } from "motion/react";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/submit-button";
import { toBlocks } from "@/lib/domain/ai";
import { summarizeTeam } from "../ai/actions";

/** Resumen del equipo redactado por la IA, bajo demanda (no se genera solo para no gastar). */
export function TeamSummary({ orgId, enabled }: { orgId: string; enabled: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError(null);
      const r = await summarizeTeam(orgId);
      if (r.ok) setText(r.data);
      else setError(r.error);
    });

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-accent" /> Resumen del equipo
          </span>
        }
        description="Cómo viene el mes, quién estará fuera y qué atender"
        action={
          enabled && text ? (
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              aria-label="Regenerar resumen"
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
            </button>
          ) : null
        }
      />
      <CardBody className="pt-3">
        {!enabled ? (
          <p className="text-[13px] text-muted-foreground">
            Con la IA activada, acá vas a tener un resumen redactado de tu equipo en un click.
          </p>
        ) : pending && !text ? (
          <div className="grid gap-2">
            {[95, 80, 88, 60].map((w, i) => (
              <span key={i} className="h-3 animate-pulse rounded-full bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : text ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: pending ? 0.5 : 1 }}
            className="grid gap-2 text-[13.5px] leading-relaxed"
          >
            {toBlocks(text).map((b, i) =>
              b.type === "p" ? (
                <p key={i}>{b.text}</p>
              ) : (
                <ul key={i} className="grid list-disc gap-1.5 pl-5">
                  {b.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              ),
            )}
          </motion.div>
        ) : (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={generate}
              className="inline-flex h-10 items-center justify-center gap-2 justify-self-start rounded-xl bg-foreground px-4 text-[13px] font-medium text-background"
            >
              {pending ? <Spinner /> : <Sparkles className="size-4" />} Generar resumen
            </button>
            {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
