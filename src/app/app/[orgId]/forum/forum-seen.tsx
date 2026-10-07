"use client";

import { useEffect } from "react";
import { markForumSeen } from "./actions";

/** Al abrir la lista del foro se marca como visto: el aviso del menú vuelve a cero. */
export function ForumSeen({ orgId }: { orgId: string }) {
  useEffect(() => {
    void markForumSeen(orgId);
  }, [orgId]);
  return null;
}
