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
  avatar: string | null;
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
  const nested = depth > 0;

  const body = (
    <>
      <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Avatar name={post.author} src={post.avatar} size={nested ? 22 : 26} />
        <span className="font-medium text-foreground/80">{post.author}</span>
        {isOp ? <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">Autor</span> : null}
        <span aria-hidden>·</span>
        <TimeAgo iso={post.created_at} />
        <span className="ml-auto">
          {post.author_id === props.me || props.isModerator ? <DeletePostButton orgId={props.orgId} postId={post.id} /> : null}
        </span>
      </div>
      <p className={cn("mt-2 leading-relaxed whitespace-pre-line", nested ? "text-[14px]" : "text-[14.5px]")}>
        <MentionText body={post.body} people={post.mentioned} />
      </p>
      <div className="mt-2 -ml-2.5 flex flex-wrap items-center gap-1">
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
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
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

      {/* Las respuestas a esta respuesta van dentro de la misma tarjeta, con una línea guía */}
      {children.length > 0 && !collapsed ? (
        <ol className={cn("mt-2 grid", depth < MAX_INDENT && "ml-2.5 border-l-2 border-border pl-4")}>
          {children.map((child) => (
            <PostItem key={child.post.id} node={child} depth={depth + 1} props={props} />
          ))}
        </ol>
      ) : null}
      {children.length > 0 && collapsed ? (
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CornerDownRight className="size-3.5" />
          {descendants === 1 ? "1 respuesta oculta" : `${descendants} respuestas ocultas`}
        </p>
      ) : null}
    </>
  );

  // Todo vive en la tarjeta del hilo: las respuestas directas se separan con una línea y la
  // conversación que cuelga de cada una se corre a la derecha con una línea guía
  return (
    <li id={`post-${post.id}`} className={nested ? "pt-3 pb-1" : "border-t border-border py-4 first:border-t-0 sm:py-5"}>
      {body}
    </li>
  );
}

/** Respuestas del hilo en árbol: cada una se puede contestar y las conversaciones se pliegan. */
export function PostTree({ posts, ...props }: TreeProps & { posts: PostView[] }) {
  const tree = useMemo(() => buildPostTree(posts), [posts]);
  return (
    <ol className="grid">
      {tree.map((node) => (
        <PostItem key={node.post.id} node={node} depth={0} props={props} />
      ))}
    </ol>
  );
}
