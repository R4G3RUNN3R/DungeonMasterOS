// client/src/components/game/CodexOverlay.tsx
//
// Lore/character-notes content, presented as an interactive open tome
// (design spec §4.4/§12.2 — the one overlay the spec singles out for
// stronger page/book presentation). A two-page spread on wide screens
// (left page: Traits/Backstory, right page: Abilities + other sections)
// with a spine gutter down the middle; single scrolling page on mobile.
// Content is unchanged from the plain-Dialog version — this is a visual
// treatment pass, not a data change.

import { useMemo } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type ParsedSection = {
  label: string;
  type?: string;
  entries?: Array<{ key?: string; name?: string; value?: string; description?: string }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traits: string;
  backstory: string;
  characterData: string;
};

function safeParseSections(raw: string): ParsedSection[] {
  try {
    const parsed = JSON.parse(raw || "{}");
    return Array.isArray(parsed.sections) ? parsed.sections : [];
  } catch {
    return [];
  }
}

function EntryList({ entries }: { entries?: ParsedSection["entries"] }) {
  if (!entries?.length) {
    return <p className="text-sm text-[hsl(var(--dm-parchment-muted))]">No entries.</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => (
        <div
          key={`${entry.key || entry.name || "entry"}-${idx}`}
          className="rounded-sm border border-[hsl(var(--dm-parchment-line))] px-3 py-2 text-sm"
        >
          <div className="font-medium">{entry.name || entry.key || "Entry"}</div>
          {(entry.description || entry.value) && (
            <div className="text-xs text-[hsl(var(--dm-parchment-muted))] mt-1 whitespace-pre-wrap">
              {entry.description || entry.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CodexOverlay({ open, onOpenChange, traits, backstory, characterData }: Props) {
  const sections = useMemo(() => safeParseSections(characterData), [characterData]);

  const grantedAbilities = useMemo(
    () =>
      sections.find(
        (s) => String(s.label || "").toLowerCase() === "granted abilities" || String(s.type || "").toLowerCase() === "abilities",
      ),
    [sections],
  );

  const otherSections = useMemo(
    () =>
      sections.filter((s) => {
        const label = String(s.label || "").toLowerCase();
        return label !== "granted abilities" && label !== "currency" && label !== "inventory" && label !== "items";
      }),
    [sections],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dm-shell dm-tome border-none max-w-3xl max-h-[85vh] overflow-hidden p-0 gap-0">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <BookOpen className="w-4 h-4" style={{ color: "hsl(var(--dm-bronze))" }} />
          <DialogTitle className="dm-heading text-lg font-semibold">Codex</DialogTitle>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 overflow-y-auto dm-scroll" style={{ maxHeight: "70vh" }}>
          {/* Spine gutter shadow, visible only on the two-page desktop spread */}
          <div className="hidden md:block absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 dm-tome-spine pointer-events-none" />

          {/* Left page */}
          <div className="px-6 pb-6 md:pr-8 space-y-5 md:border-r border-[hsl(var(--dm-parchment-line))]">
            <div className="space-y-2">
              <div className="dm-heading text-xs uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>
                Traits
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{traits?.trim() || "No traits entered."}</p>
            </div>

            <div className="space-y-2">
              <div className="dm-heading text-xs uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>
                Backstory
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{backstory?.trim() || "No backstory entered."}</p>
            </div>
          </div>

          {/* Right page */}
          <div className="px-6 pb-6 md:pl-8 pt-5 md:pt-0 space-y-5">
            <div className="space-y-2">
              <div className="dm-heading text-xs uppercase tracking-wide flex items-center gap-1" style={{ color: "hsl(var(--dm-bronze))" }}>
                <Sparkles className="w-3 h-3" />
                Abilities &amp; Features
              </div>
              {grantedAbilities?.entries?.length ? (
                <EntryList entries={grantedAbilities.entries} />
              ) : (
                <p className="text-sm text-[hsl(var(--dm-parchment-muted))]">No tracked granted abilities yet.</p>
              )}
            </div>

            {otherSections.map((section, sectionIndex) => (
              <div key={`${section.label}-${sectionIndex}`} className="space-y-2">
                <div className="dm-heading text-xs uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>
                  {section.label || "Section"}
                </div>
                <EntryList entries={section.entries} />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
