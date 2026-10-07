"use client";

import { ChevronDown, CornerDownRight, MessageSquareReply } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { TimeAgo } from "@/components/ui/time-ago";
import { buildPostTree, type PostNode } from "@/lib/domain/forum";
import type { Mentionable } from "@/lib/domain/mentions";
import { cn } from "@/lib/utils";
import { DeletePostButton } from "./delete-post-button";
import { MentionText } from "./mention-text";
import { ReplyForm } from "./reply-form";

export interface PostView {
  id: string;
  parent_id: string | null;
  author_id: string | null;
  author: string;
  body: string;
  created_at: string;
  /** Personas mencionadas de verdad en esta respuesta (para resaltarlas) */
  mentioned: Mentionable[];
}

interface TreeProps {
  orgId: string;
  threadId: string;
  me: string;
  isModerator: boolean;
  canReply: boolean;
  threadAuthorId: string | null;
  people: Mentionable[];
}

/** A partir de este nivel las respuestas no se siguen corriendo a la derecha. */
const MAX_INDENT = 3;

function PostItem({ node, depth, props }: { node: PostNode<PostView>; depth: number; props: TreeProps }) {
  const { post, children, descendants } = node;
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const closeReply = useCallback(() => setReplying(false), []);
  const isOp = post.author_id !== null && post.author_id === props.threadAuthorId;

  return (
    <li id={`post-${post.id}`}>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <Avatar name={post.author} size={26} />
          <span className="font-medium text-foreground/80">{post.author}</span>
          {isOp ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">Autor</span> : null}
          <span aria-hidden>·</span>
          <TimeAgo iso={post.created_at} />
          <span className="ml-auto">
            {post.author_id === props.me || props.isModerator ? <DeletePostButton orgId={props.orgId} postId={post.id} /> : null}
          </span>
        </div>
        <p className="mt-2.5 text-[14.5px] leading-relaxed whitespace-pre-line">
          <MentionText body={post.body} people={post.mentioned} />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {props.canReply ? (
            <button
              type="button"
              onClick={() => setReplying((r) => !r)}
              aria-expanded={replying}
              aria-label={`Responder a ${post.author}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MessageSquareReply className="size-3.5" /> Responder
            </button>
          ) : null}
          {descendants > 0 ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", collapsed && "-rotate-90")} />
              {collapsed ? `Ver ${descendants === 1 ? "1 respuesta" : `${descendants} respuestas`}` : "Ocultar respuestas"}
            </button>
          ) : null}
        </div>
        {replying ? (
          <div className="mt-3 border-t border-border pt-3">
            <ReplyForm
              orgId={props.orgId}
              threadId={props.threadId}
              people={props.people}
              parentId={post.id}
              replyingTo={post.author}
              onDone={closeReply}
            />
          </div>
        ) : null}
      </div>

      {children.length > 0 && !collapsed ? (
        <ol
          className={cn(
            "mt-2 grid gap-2",
            // Línea guía a la izquierda, como en los hilos de un foro profesional
            depth < MAX_INDENT && "ml-4 border-l-2 border-border pl-4 sm:ml-6 sm:pl-5",
          )}
        >
          {children.map((child) => (
            <PostItem key={child.post.id} node={child} depth={depth + 1} props={props} />
          ))}
        </ol>
      ) : null}
      {children.length > 0 && collapsed ? (
        <p className="mt-1.5 ml-5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CornerDownRight className="size-3.5" />
          {descendants === 1 ? "1 respuesta oculta" : `${descendants} respuestas ocultas`}
        </p>
      ) : null}
    </li>
  );
}

/** Respuestas del hilo en árbol: cada una se puede contestar y las conversaciones se pliegan. */
export function PostTree({ posts, ...props }: TreeProps & { posts: PostView[] }) {
  const tree = useMemo(() => buildPostTree(posts), [posts]);
  return (
    <ol className="grid gap-3">
      {tree.map((node) => (
        <PostItem key={node.post.id} node={node} depth={0} props={props} />
      ))}
    </ol>
  );
}
