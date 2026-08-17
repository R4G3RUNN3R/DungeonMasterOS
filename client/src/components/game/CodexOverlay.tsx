// client/src/components/game/CodexOverlay.tsx
//
// Lore/character-notes content moved out of the old always-visible sidebar
// into a dedicated Codex overlay, per design spec §4.4/§12.2 ("present as
// an interactive open tome/book" — the book-metaphor styling is Phase 5;
// this preserves the underlying content and reachability now). Shows
// granted abilities, traits, backstory, and any other freeform
// characterData sections the old sidebar used to render inline.

import { useMemo } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
      <DialogContent className="dm-shell dm-surface border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="dm-heading flex items-center gap-2">
            <BookOpen className="w-4 h-4 dm-amber-text" />
            Codex
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="dm-label">Traits</div>
            <p className="text-sm text-[hsl(var(--dm-text-muted))] whitespace-pre-wrap leading-relaxed">
              {traits?.trim() || "No traits entered."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="dm-label">Backstory</div>
            <p className="text-sm text-[hsl(var(--dm-text-muted))] whitespace-pre-wrap leading-relaxed">
              {backstory?.trim() || "No backstory entered."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="dm-label flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Abilities &amp; Features
            </div>
            {grantedAbilities?.entries?.length ? (
              <div className="space-y-2">
                {grantedAbilities.entries.map((entry, idx) => (
                  <div key={`${entry.key || entry.name || "ability"}-${idx}`} className="dm-surface-raised rounded-lg px-3 py-2 text-sm">
                    <div className="font-medium">{entry.name || entry.key || "Ability"}</div>
                    {(entry.description || entry.value) && (
                      <div className="text-xs text-[hsl(var(--dm-text-faint))] mt-1 whitespace-pre-wrap">
                        {entry.description || entry.value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[hsl(var(--dm-text-faint))]">No tracked granted abilities yet.</p>
            )}
          </div>

          {otherSections.map((section, sectionIndex) => (
            <div key={`${section.label}-${sectionIndex}`} className="space-y-2">
              <div className="dm-label">{section.label || "Section"}</div>
              {section.entries?.length ? (
                <div className="space-y-2">
                  {section.entries.map((entry, entryIndex) => (
                    <div key={`${entry.key || entry.name || "entry"}-${entryIndex}`} className="dm-surface-raised rounded-lg px-3 py-2 text-sm">
                      <div className="font-medium">{entry.name || entry.key || "Entry"}</div>
                      {(entry.description || entry.value) && (
                        <div className="text-xs text-[hsl(var(--dm-text-faint))] mt-1 whitespace-pre-wrap">
                          {entry.description || entry.value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[hsl(var(--dm-text-faint))]">No entries.</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
