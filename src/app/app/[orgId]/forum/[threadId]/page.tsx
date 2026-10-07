import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock, MessageSquare, Pin } from "lucide-react";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { TimeAgo } from "@/components/ui/time-ago";
import { getMentionables, getThread, getThreads } from "@/lib/data/forum";
import { requirePermission } from "@/lib/data/session";
import { relatedThreads, threadAbilities, threadParticipants } from "@/lib/domain/forum";
import { CategoryBadge } from "../category-badge";
import { MentionText } from "../mention-text";
import { PostTree } from "../post-tree";
import { ReplyForm } from "../reply-form";
import { ThreadControls } from "../thread-controls";
import { ThreadSidebar } from "../thread-sidebar";

export async function generateMetadata({ params }: PageProps<"/app/[orgId]/forum/[threadId]">): Promise<Metadata> {
  const { orgId, threadId } = await params;
  if (!z.guid().safeParse(threadId).success) return { title: "Foro" };
  const data = await getThread(orgId, threadId);
  return { title: data ? `${data.thread.title} · Foro` : "Foro" };
}

export default async function ThreadPage({ params }: PageProps<"/app/[orgId]/forum/[threadId]">) {
  const { orgId, threadId } = await params;
  if (!z.guid().safeParse(threadId).success) notFound();
  const ctx = await requirePermission(orgId, "workspace.access");
  const [data, mentionables, threads] = await Promise.all([getThread(orgId, threadId), getMentionables(orgId), getThreads(orgId)]);
  if (!data) notFound();

  const { thread, posts } = data;
  const me = ctx.membership.id;
  const isModerator = ctx.can("forum.moderate");
  const can = threadAbilities(thread, { isAuthor: thread.author_id === me, isModerator });
  // Solo se resaltan las menciones reales (las que guardó la base), no cualquier "@Nombre"
  const mentioned = (ids: string[]) => mentionables.filter((p) => ids.includes(p.id));

  return (
    // En escritorio la tarjeta ocupa el alto disponible y la conversación hace scroll por
    // dentro: el hilo no crece con cada respuesta. Al costado, "Sobre este hilo".
    <div className="mx-auto max-w-6xl lg:flex lg:h-full lg:flex-col">
      <Link
        href={`/app/forum`}
        className="mb-4 inline-flex shrink-0 items-center gap-1.5 self-start text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Volver al foro
      </Link>

      <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
        {/* Todo el hilo en una sola tarjeta, como en un foro clásico: publicación, acciones,
          caja para responder y la conversación debajo, separada por líneas */}
        <article className="overflow-hidden rounded-2xl border border-border bg-card lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={thread.category} />
                {thread.pinned ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-accent">
                    <Pin className="size-3.5" /> Fijado
                  </span>
                ) : null}
                {thread.resolved ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
                    <CheckCircle2 className="size-3.5" /> Resuelto
                  </span>
                ) : null}
                {thread.locked ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Lock className="size-3.5" /> Cerrado
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-[24px] leading-tight font-semibold tracking-[-0.03em] sm:text-[28px]">{thread.title}</h1>
              <div className="mt-3 flex items-center gap-2.5 text-[13px] text-muted-foreground">
                <Avatar name={thread.author.name} src={thread.author.avatar} size={28} />
                <span className="font-medium text-foreground/80">{thread.author.name}</span>
                <span aria-hidden>·</span>
                <TimeAgo iso={thread.created_at} />
                {thread.edited_at ? <span>(editado)</span> : null}
              </div>
              {/* Texto plano: se respetan los saltos de línea, sin HTML */}
              <div className="mt-5 text-[15px] leading-relaxed whitespace-pre-line">
                <MentionText body={thread.body} people={mentioned(thread.mentions)} />
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-border px-3 py-2 sm:px-5">
              <h2 className="inline-flex h-8 items-center gap-1.5 px-2 text-[12.5px] font-medium text-muted-foreground">
                <MessageSquare className="size-3.5" />
                {posts.length === 0 ? "Sin respuestas" : posts.length === 1 ? "1 respuesta" : `${posts.length} respuestas`}
              </h2>
              <div className="min-w-0 flex-1">
                <ThreadControls
                  orgId={orgId}
                  thread={{
                    id: thread.id,
                    category: thread.category,
                    title: thread.title,
                    body: thread.body,
                    pinned: thread.pinned,
                    locked: thread.locked,
                    resolved: thread.resolved,
                  }}
                  can={can}
                />
              </div>
            </div>

            <div className="border-t border-border bg-muted/30 px-5 py-4 sm:px-7">
              {can.canReply ? (
                <>
                  {thread.locked ? (
                    <p className="mb-3 text-[12.5px] text-muted-foreground">El hilo está cerrado: respondés como moderación.</p>
                  ) : null}
                  <ReplyForm orgId={orgId} threadId={thread.id} people={mentionables.filter((p) => p.id !== me)} />
                </>
              ) : (
                <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
                  <Lock className="size-4" /> La administración cerró este hilo: ya no admite respuestas.
                </p>
              )}
            </div>

            {posts.length > 0 ? (
              <section className="border-t border-border px-5 sm:px-7" aria-label="Respuestas">
                <PostTree
                  orgId={orgId}
                  threadId={thread.id}
                  me={me}
                  isModerator={isModerator}
                  canReply={can.canReply}
                  threadAuthorId={thread.author_id}
                  people={mentionables.filter((p) => p.id !== me)}
                  posts={posts.map((p) => ({
                    id: p.id,
                    parent_id: p.parent_id,
                    author_id: p.author_id,
                    author: p.author.name,
                    avatar: p.author.avatar,
                    body: p.body,
                    created_at: p.created_at,
                    mentioned: mentioned(p.mentions),
                  }))}
                />
              </section>
            ) : null}
          </div>
        </article>

        <div className="lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
          <ThreadSidebar
            thread={{
              category: thread.category,
              pinned: thread.pinned,
              locked: thread.locked,
              resolved: thread.resolved,
              created_at: thread.created_at,
              last_activity_at: thread.last_activity_at,
              replies: posts.length,
            }}
            participants={threadParticipants(
              thread.author,
              posts.map((p) => ({ author_id: p.author_id, author: p.author.name, avatar: p.author.avatar, created_at: p.created_at })),
            )}
            related={relatedThreads(threads, thread).map((t) => ({
              id: t.id,
              title: t.title,
              category: t.category,
              reply_count: t.reply_count,
              last_activity_at: t.last_activity_at,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
