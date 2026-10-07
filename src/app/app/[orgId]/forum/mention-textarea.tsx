"use client";

import { forwardRef, useId, useLayoutEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { mentionedIds, mentionQueryAt, suggestMentions, type Mentionable } from "@/lib/domain/mentions";
import { cn } from "@/lib/utils";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  people: Mentionable[];
  defaultValue?: string;
};

/**
 * Textarea con menciones: al escribir @ aparece la lista de compañeros (flechas + Enter
 * o click para elegir). Envía aparte, en el campo "mentions", a quiénes se mencionó.
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { people, defaultValue = "", name, className, ...props },
  forwardedRef,
) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const local = useRef<HTMLTextAreaElement | null>(null);
  // Dónde dejar el cursor después de insertar una mención (se aplica antes de pintar)
  const caretAfterPick = useRef<number | null>(null);
  const listId = useId();

  useLayoutEffect(() => {
    if (caretAfterPick.current === null || !local.current) return;
    local.current.setSelectionRange(caretAfterPick.current, caretAfterPick.current);
    caretAfterPick.current = null;
  }, [value]);

  const suggestions = useMemo(() => (query ? suggestMentions(query.query, people) : []), [query, people]);
  const open = suggestions.length > 0;
  const mentions = useMemo(() => mentionedIds(value, people), [value, people]);

  const update = (text: string, caret: number) => {
    setValue(text);
    setQuery(mentionQueryAt(text, caret));
    setHighlight(0);
  };

  const pick = (person: Mentionable) => {
    if (!query || !local.current) return;
    const caret = local.current.selectionStart;
    const next = `${value.slice(0, query.start)}@${person.name} ${value.slice(caret)}`;
    const pos = query.start + person.name.length + 2;
    caretAfterPick.current = pos;
    setValue(next);
    setQuery(null);
  };

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={(el) => {
          local.current = el;
          if (typeof forwardedRef === "function") forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
        }}
        name={name}
        value={value}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        onChange={(e) => update(e.target.value, e.target.selectionStart)}
        onClick={(e) => setQuery(mentionQueryAt(value, e.currentTarget.selectionStart))}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(suggestions[highlight]);
          } else if (e.key === "Escape") {
            setQuery(null);
          }
        }}
      />
      <input type="hidden" name="mentions" value={JSON.stringify(mentions)} />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mencionar a"
          className="absolute left-2 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.3)]"
        >
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px]",
                i === highlight ? "bg-accent-soft text-foreground" : "text-muted-foreground",
              )}
            >
              <Avatar name={p.name} size={22} />
              {p.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
