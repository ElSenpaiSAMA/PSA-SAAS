import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { buttonClasses } from "@/components/ui/button";
import { getForumSeenAt, getThreads } from "@/lib/data/forum";
import { getOrgContext } from "@/lib/data/session";
import { ForumSeen } from "./forum-seen";
import { ThreadList, type ThreadItem } from "./thread-list";

export const metadata: Metadata = { title: "Foro" };

export default async function ForumPage({ params }: PageProps<"/app/[orgId]/forum">) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const [threads, seenAt] = await Promise.all([getThreads(orgId), getForumSeenAt(ctx.membership.id, ctx.membership.created_at)]);

  // Solo datos serializables al cliente
  const items: ThreadItem[] = threads.map((t) => ({
    id: t.id,
    category: t.category,
    title: t.title,
    body: t.body,
    pinned: t.pinned,
    locked: t.locked,
    resolved: t.resolved,
    reply_count: t.reply_count,
    created_at: t.created_at,
    last_activity_at: t.last_activity_at,
    author: t.author.name,
    // Novedad: actividad de otra persona desde mi última visita
    unread: t.last_activity_at > seenAt && t.last_author_id !== ctx.membership.id,
  }));

  return (
    <>
      <PageHeader
        title="Foro"
        accent="del equipo"
        description="Dudas, incidencias técnicas y avisos. Solo lo ve la gente de la empresa."
        actions={
          <Link href={`/app/${orgId}/forum/new`} className={buttonClasses("primary")}>
            <Plus className="size-4" />
            Nuevo hilo
          </Link>
        }
      />
      <ForumSeen orgId={orgId} />
      <ThreadList orgId={orgId} threads={items} />
    </>
  );
}
