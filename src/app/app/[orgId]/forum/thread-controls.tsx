"use client";

import { CheckCircle2, Lock, LockOpen, Pencil, Pin, PinOff, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";
import type { ThreadAbilities } from "@/lib/domain/forum";
import type { ForumCategory } from "@/lib/supabase/database.types";
import { deleteThread, editThread, setThreadFlags } from "./actions";
import { ThreadForm } from "./thread-form";

export function ThreadControls({
  orgId,
  thread,
  can,
}: {
  orgId: string;
  thread: { id: string; category: ForumCategory; title: string; body: string; pinned: boolean; locked: boolean; resolved: boolean };
  can: ThreadAbilities;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const closeEditor = useCallback(() => setEditing(false), []);

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const res = await fn();
      if (res.status === "success") toast.success(res.message);
      else toast.error(res.message);
    });

  const flag = (flags: Parameters<typeof setThreadFlags>[2]) => run(() => setThreadFlags(orgId, thread.id, flags));

  const remove = () => {
    if (!window.confirm("¿Borrar el hilo y todas sus respuestas? No se puede deshacer.")) return;
    // Si sale bien, la acción redirige a la lista
    run(() => deleteThread(orgId, thread.id));
  };

  if (!can.canEdit && !can.canDelete && !can.canModerate && !can.canResolve) return null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" aria-busy={pending}>
        {can.canResolve ? (
          <Button size="sm" variant={thread.resolved ? "secondary" : "accent"} disabled={pending} onClick={() => flag({ resolved: !thread.resolved })}>
            {thread.resolved ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {thread.resolved ? "Marcar sin resolver" : "Marcar como resuelto"}
          </Button>
        ) : null}
        {can.canModerate ? (
          <>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => flag({ pinned: !thread.pinned })}>
              {thread.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              {thread.pinned ? "Desfijar" : "Fijar arriba"}
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => flag({ locked: !thread.locked })}>
              {thread.locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
              {thread.locked ? "Reabrir" : "Cerrar hilo"}
            </Button>
          </>
        ) : null}
        {can.canEdit ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing((e) => !e)}>
            {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
            {editing ? "Cancelar edición" : "Editar"}
          </Button>
        ) : null}
        {can.canDelete ? (
          <Button size="sm" variant="danger" disabled={pending} onClick={remove}>
            <Trash2 className="size-3.5" />
            Borrar hilo
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <ThreadForm
            action={editThread.bind(null, orgId, thread.id)}
            initial={{ category: thread.category, title: thread.title, body: thread.body }}
            submitLabel="Guardar cambios"
            onDone={closeEditor}
          />
        </div>
      ) : null}
    </div>
  );
}
