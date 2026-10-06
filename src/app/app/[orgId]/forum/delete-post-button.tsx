"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deletePost } from "./actions";

export function DeletePostButton({ orgId, postId }: { orgId: string; postId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-7 rounded-lg"
      aria-label="Borrar respuesta"
      title="Borrar respuesta"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Borrar esta respuesta?")) return;
        start(async () => {
          const res = await deletePost(orgId, postId);
          if (res.status === "success") toast.success(res.message);
          else toast.error(res.message);
        });
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
