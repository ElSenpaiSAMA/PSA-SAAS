"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import type { ProjectStatus } from "@/lib/supabase/database.types";
import { setProjectStatus } from "../actions";

export function ArchiveButton({ orgId, projectId, status }: { orgId: string; projectId: string; status: ProjectStatus }) {
  const [pending, start] = useTransition();
  const next = status === "active" ? "archived" : "active";
  const Icon = status === "active" ? Archive : ArchiveRestore;

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setProjectStatus(orgId, projectId, next);
          if (r.status === "error") toast.error(r.message);
          else toast.success(r.message);
        })
      }
    >
      {pending ? <Spinner /> : <Icon className="size-4" strokeWidth={1.75} />}
      {status === "active" ? "Archivar" : "Reactivar"}
    </Button>
  );
}
