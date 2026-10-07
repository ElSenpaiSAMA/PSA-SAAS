"use client";

import { motion } from "motion/react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistant } from "@/app/app/[orgId]/ai/actions";
import { toBlocks } from "@/lib/domain/ai";

interface Turn {
  question: string;
  answer?: string;
  error?: string;
}

/** Conversación con el asistente dentro de la paleta (⌘K). */
export function AssistantView({ orgId, initialQuestion, onBack }: { orgId: string; initialQuestion: string; onBack: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const asked = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const ask = (question: string) => {
    setTurns((t) => [...t, { question }]);
    start(async () => {
      const r = await askAssistant(orgId, question);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, ...(r.ok ? { answer: r.data } : { error: r.error }) } : turn)));
    });
  };

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    ask(initialQuestion);
    // Solo la primera pregunta, al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns, pending]);

  return (
    <div className="flex max-h-[min(70vh,560px)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a la búsqueda"
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <Sparkles className="size-4 text-accent" />
        <span className="text-[13.5px] font-medium">Asistente IA</span>
        <span className="ml-auto text-[11.5px] text-muted-foreground">Responde con tus datos y tus permisos</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
        <div className="grid gap-5">
          {turns.map((t, i) => (
            <div key={i} className="grid gap-2">
              <p className="justify-self-end rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-[13.5px] text-background">
                {t.question}
              </p>
              {t.answer ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid gap-2 text-[13.5px] leading-relaxed"
                >
                  {toBlocks(t.answer).map((b, j) =>
                    b.type === "p" ? (
                      <p key={j}>{b.text}</p>
                    ) : (
                      <ul key={j} className="grid list-disc gap-1 pl-5">
                        {b.items.map((it, k) => (
                          <li key={k}>{it}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </motion.div>
              ) : t.error ? (
                <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">{t.error}</p>
              ) : (
                <div className="grid gap-2" aria-label="Pensando…">
                  {[90, 70, 80].map((w, j) => (
                    <span key={j} className="h-3 animate-pulse rounded-full bg-muted" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </div>

      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const q = draft.trim();
          if (q.length < 3 || pending) return;
          setDraft("");
          ask(q);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Hacé otra pregunta…"
          aria-label="Otra pregunta"
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3.5 text-[13.5px] outline-none focus:border-border-strong"
        />
        <button
          type="submit"
          disabled={pending || draft.trim().length < 3}
          className="h-10 rounded-xl bg-foreground px-4 text-[13px] font-medium text-background disabled:opacity-40"
        >
          Preguntar
        </button>
      </form>
    </div>
  );
}
