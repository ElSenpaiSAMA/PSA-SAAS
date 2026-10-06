import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CATEGORY_LABEL } from "@/lib/domain/forum";
import type { ForumCategory } from "@/lib/supabase/database.types";

const TONE: Record<ForumCategory, BadgeTone> = {
  question: "accent",
  incident: "warning",
  notice: "success",
};

export function CategoryBadge({ category }: { category: ForumCategory }) {
  return (
    <Badge tone={TONE[category]} dot>
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}
