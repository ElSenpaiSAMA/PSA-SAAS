import { splitMentions, type Mentionable } from "@/lib/domain/mentions";

/** Texto de un mensaje con las menciones resaltadas. Texto plano: nunca se interpreta HTML. */
export function MentionText({ body, people }: { body: string; people: Mentionable[] }) {
  return (
    <>
      {splitMentions(body, people).map((c, i) =>
        c.type === "mention" ? (
          <span key={i} className="rounded-md bg-accent-soft px-1 font-medium text-accent">
            {c.text}
          </span>
        ) : (
          <span key={i}>{c.text}</span>
        ),
      )}
    </>
  );
}
