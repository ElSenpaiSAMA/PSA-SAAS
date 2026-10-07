import type { Metadata } from "next";
import { Activity, Power, Workflow } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAutomationsOverview } from "@/lib/data/automations";
import { requirePermission } from "@/lib/data/session";
import { AREA_LABEL, AUTOMATION_BY_KEY, AUTOMATIONS, effectiveConfig, type AutomationArea } from "@/lib/domain/automations";
import { AutomationCard } from "./automation-card";

export const metadata: Metadata = { title: "Automatizaciones" };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export default async function AutomationsPage({ params }: PageProps<"/app/[orgId]/automations">) {
  const { orgId } = await params;
  await requirePermission(orgId, "automations.manage");
  const { templates, rules, runs, counts, lastRun } = await getAutomationsOverview(orgId);

  const templateByKey = new Map(templates.map((t) => [t.key, t]));
  const ruleByKey = new Map(rules.map((r) => [r.key, r]));
  const cards = AUTOMATIONS.filter((a) => templateByKey.has(a.key)).map((meta) => {
    const template = templateByKey.get(meta.key)!;
    const config = effectiveConfig(template, ruleByKey.get(meta.key));
    return { meta, kind: template.trigger_kind, ...config };
  });
  const areas = [...new Set(cards.map((c) => c.meta.area))] as AutomationArea[];
  const active = cards.filter((c) => c.enabled).length;
  const actions30 = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader
        title="Automatizaciones"
        description="Reglas que trabajan solas: avisan, recuerdan, cierran y crean cosas por vos. Activá las que quieras y ajustá sus valores."
      />

      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <StatCard index={0} label="Activas" value={active} icon={Power} hint={`de ${cards.length} disponibles`} />
        <StatCard index={1} label="Acciones en 30 días" value={actions30} icon={Activity} hint="Avisos enviados y cambios hechos" />
        <StatCard index={2} label="Frecuencia" value={15} icon={Workflow} hint="minutos entre revisiones programadas" />
      </div>

      <div className="mt-8 grid gap-10">
        {areas.map((area) => (
          <section key={area} aria-labelledby={`area-${area}`}>
            <h2 id={`area-${area}`} className="mb-3 text-[15px] font-semibold tracking-tight">
              {AREA_LABEL[area]}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {cards
                .filter((c) => c.meta.area === area)
                .map((c) => (
                  <AutomationCard
                    key={c.meta.key}
                    orgId={orgId}
                    meta={c.meta}
                    kind={c.kind}
                    enabled={c.enabled}
                    params={c.params}
                    count={counts[c.meta.key] ?? 0}
                    lastRunLabel={lastRun[c.meta.key] ? fmt(lastRun[c.meta.key]) : null}
                  />
                ))}
            </div>
          </section>
        ))}

        <section aria-labelledby="historial">
          <h2 id="historial" className="mb-3 text-[15px] font-semibold tracking-tight">
            Historial de ejecuciones
          </h2>
          {runs.length ? (
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {runs.map((run) => (
                <li key={run.id} className="grid gap-x-4 gap-y-0.5 px-4 py-3 text-[13px] sm:grid-cols-[9rem_14rem_minmax(0,1fr)]">
                  <time className="text-muted-foreground tabular" dateTime={run.created_at}>
                    {fmt(run.created_at)}
                  </time>
                  <span className="font-medium">{AUTOMATION_BY_KEY.get(run.rule_key)?.name ?? run.rule_key}</span>
                  <span className="truncate text-muted-foreground">
                    {run.dedupe_key.startsWith("error:") ? `Error: ${run.detail}` : run.detail}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              icon={Activity}
              title="Todavía no se ejecutó ninguna"
              description="Cuando una regla haga algo (avisar, cerrar, crear), queda registrado acá."
            />
          )}
        </section>
      </div>
    </>
  );
}
