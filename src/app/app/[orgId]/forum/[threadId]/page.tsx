import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock, Pin } from "lucide-react";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { TimeAgo } from "@/components/ui/time-ago";
import { getThread } from "@/lib/data/forum";
import { getOrgContext } from "@/lib/data/session";
import { threadAbilities } from "@/lib/domain/forum";
import { CategoryBadge } from "../category-badge";
import { DeletePostButton } from "../delete-post-button";
import { ReplyForm } from "../reply-form";
import { ThreadControls } from "../thread-controls";

export async function generateMetadata({ params }: PageProps<"/app/[orgId]/forum/[threadId]">): Promise<Metadata> {
  const { orgId, threadId } = await params;
  if (!z.guid().safeParse(threadId).success) return { title: "Foro" };
  const data = await getThread(orgId, threadId);
  return { title: data ? `${data.thread.title} · Foro` : "Foro" };
}

export default async function ThreadPage({ params }: PageProps<"/app/[orgId]/forum/[threadId]">) {
  const { orgId, threadId } = await params;
  if (!z.guid().safeParse(threadId).success) notFound();
  const ctx = await getOrgContext(orgId);
  const data = await getThread(orgId, threadId);
  if (!data) notFound();

  const { thread, posts } = data;
  const me = ctx.membership.id;
  const isModerator = ctx.can("forum.moderate");
  const can = threadAbilities(thread, { isAuthor: thread.author_id === me, isModerator });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/app/${orgId}/forum`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Volver al foro
      </Link>

      <article className="rounded-2xl border border-border bg-card p-5 sm:p-7">
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
          <Avatar name={thread.author.name} size={28} />
          <span className="font-medium text-foreground/80">{thread.author.name}</span>
          <span aria-hidden>·</span>
          <TimeAgo iso={thread.created_at} />
          {thread.edited_at ? <span>(editado)</span> : null}
        </div>
        {/* Texto plano: se respetan los saltos de línea, sin HTML */}
        <div className="mt-5 text-[15px] leading-relaxed whitespace-pre-line">{thread.body}</div>
      </article>

      <div className="mt-4">
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

      <section className="mt-8" aria-labelledby="replies-title">
        <h2 id="replies-title" className="mb-3 text-[13px] font-medium text-muted-foreground">
          {posts.length === 0 ? "Sin respuestas todavía" : posts.length === 1 ? "1 respuesta" : `${posts.length} respuestas`}
        </h2>
        {posts.length > 0 ? (
          <ol className="grid gap-3">
            {posts.map((p) => {
              const isOp = p.author_id !== null && p.author_id === thread.author_id;
              return (
                <li key={p.id} id={`post-${p.id}`} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                    <Avatar name={p.author.name} size={26} />
                    <span className="font-medium text-foreground/80">{p.author.name}</span>
                    {isOp ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">Autor</span> : null}
                    <span aria-hidden>·</span>
                    <TimeAgo iso={p.created_at} />
                    <span className="ml-auto">
                      {p.author_id === me || isModerator ? <DeletePostButton orgId={orgId} postId={p.id} /> : null}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed whitespace-pre-line">{p.body}</p>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        {can.canReply ? (
          <>
            {thread.locked ? (
              <p className="mb-3 text-[12.5px] text-muted-foreground">El hilo está cerrado: respondés como moderación.</p>
            ) : null}
            <ReplyForm orgId={orgId} threadId={thread.id} />
          </>
        ) : (
          <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
            <Lock className="size-4" /> La administración cerró este hilo: ya no admite respuestas.
          </p>
        )}
      </section>
    </div>
  );
}
