import { BookMarked, ExternalLink } from "lucide-react";
import type { CompendiumItem } from "@/lib/compendium";
import { sourceHref, sourceLabel } from "@/lib/compendium";

export default function CompendiumSourceLink({
  item,
  compact = false,
}: {
  item: Pick<CompendiumItem, "sourceReference" | "sourceUrl" | "sourceTitle" | "sourceKind">;
  compact?: boolean;
}) {
  const href = sourceHref(item);
  const label = sourceLabel(item);

  const content = (
    <>
      <BookMarked size={compact ? 11 : 12} aria-hidden="true" />
      <span>{compact ? "Source" : `Source · ${label}`}</span>
      {href && <ExternalLink size={compact ? 10 : 11} aria-hidden="true" />}
    </>
  );

  if (!href) {
    return (
      <span className={`compendium-source-link ${compact ? "compact" : ""}`} title={label}>
        {content}
      </span>
    );
  }

  return (
    <a
      className={`compendium-source-link ${compact ? "compact" : ""}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Source: ${label}`}
      onClick={(event) => event.stopPropagation()}
    >
      {content}
    </a>
  );
}
