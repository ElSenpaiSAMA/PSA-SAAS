"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/ui/submit-button";
import { idle } from "@/lib/actions";
import type { Mentionable } from "@/lib/domain/mentions";
import { replyToThread } from "./actions";
import { MentionTextarea } from "./mention-textarea";

export function ReplyForm({ orgId, threadId, people }: { orgId: string; threadId: string; people: Mentionable[] }) {
  const [state, action] = useActionState(replyToThread.bind(null, orgId, threadId), idle);

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  const error = state.fieldErrors?.body?.[0] ?? (state.status === "error" ? state.message : undefined);

  return (
    // La key vacía el textarea después de publicar
    <form key={state.status === "success" ? state.submittedAt : "draft"} action={action} noValidate className="grid gap-3">
      <label htmlFor="reply-body" className="text-[13px] font-medium text-foreground/80">
        Tu respuesta
      </label>
      <MentionTextarea
        people={people}
        id="reply-body"
        name="body"
        rows={4}
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
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Publicando…">Responder</SubmitButton>
      </div>
    </form>
  );
}
