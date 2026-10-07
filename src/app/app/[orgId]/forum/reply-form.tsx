"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import type { Mentionable } from "@/lib/domain/mentions";
import { replyToThread } from "./actions";
import { MentionTextarea } from "./mention-textarea";

export function ReplyForm({
  orgId,
  threadId,
  people,
  parentId,
  replyingTo,
  onDone,
}: {
  orgId: string;
  threadId: string;
  people: Mentionable[];
  /** Si viene, contesta a esa respuesta en lugar de al hilo */
  parentId?: string;
  replyingTo?: string;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(replyToThread.bind(null, orgId, threadId), idle);

  useEffect(() => {
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      onDone?.();
    }
  }, [state, onDone]);

  const error = state.fieldErrors?.body?.[0] ?? (state.status === "error" ? state.message : undefined);

  return (
    // La key vacía el textarea después de publicar
    <form key={state.status === "success" ? state.submittedAt : "draft"} action={action} noValidate className="grid gap-3">
      <label htmlFor={parentId ? `reply-${parentId}` : "reply-body"} className="text-[13px] font-medium text-foreground/80">
        {replyingTo ? `Respuesta a ${replyingTo}` : "Tu respuesta"}
      </label>
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <MentionTextarea
        people={people}
        id={parentId ? `reply-${parentId}` : "reply-body"}
        name="body"
        rows={parentId ? 3 : 4}
        autoFocus={!!parentId}
        maxLength={5000}
        placeholder="Escribí tu respuesta… (con @ mencionás a alguien)"
        aria-invalid={!!error}
        aria-describedby={error ? "reply-error" : undefined}
      />
      {error ? (
        <p id="reply-error" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onDone ? (
          <button type="button" onClick={onDone} className="h-10 rounded-xl px-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Cancelar
          </button>
        ) : null}
        <SubmitButton pendingLabel="Publicando…">Responder</SubmitButton>
      </div>
    </form>
  );
}
