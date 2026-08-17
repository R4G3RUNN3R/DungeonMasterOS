// client/src/components/game/CharacterProfileDialog.tsx
//
// Entry point opened by the HUD portrait (design spec §5). Phase 1 only
// needs the portrait slot and this entry point — the richer profile
// (scars, affiliations, earned titles) described in the spec is future
// work that depends on systems this branch doesn't have yet. What's shown
// here is real: identity plus the character's own traits/backstory text,
// which already exist as live fields.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CharacterHudModel } from "@/lib/rulesAdapters";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hud: CharacterHudModel;
  traits: string;
  backstory: string;
};

export default function CharacterProfileDialog({ open, onOpenChange, hud, traits, backstory }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dm-shell dm-surface border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="dm-heading flex items-center gap-3">
            <span className="w-14 h-14 rounded-full dm-surface-raised border-2 flex items-center justify-center shrink-0" style={{ borderColor: "hsl(var(--dm-bronze))" }}>
              {hud.portraitUrl ? (
                <img src={hud.portraitUrl} alt={hud.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="dm-amber-text text-lg">{hud.name.slice(0, 1).toUpperCase() || "?"}</span>
              )}
            </span>
            <span>
              <div>{hud.name}</div>
              <div className="text-xs font-normal text-[hsl(var(--dm-text-muted))]">
                {hud.race ?? "Unknown race"} · {hud.classSummary ?? "Unknown class"}
              </div>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="dm-label">Age</div>
              <div>{hud.age ?? "Unknown"}</div>
            </div>
            <div>
              <div className="dm-label">Alignment</div>
              <div>{hud.alignment ?? "Unknown"}</div>
            </div>
          </div>

          {traits && (
            <div>
              <div className="dm-label mb-1">Traits</div>
              <p className="text-[hsl(var(--dm-text-muted))] whitespace-pre-wrap leading-relaxed">{traits}</p>
            </div>
          )}

          {backstory && (
            <div>
              <div className="dm-label mb-1">Backstory</div>
              <p className="text-[hsl(var(--dm-text-muted))] whitespace-pre-wrap leading-relaxed">{backstory}</p>
            </div>
          )}

          {!traits && !backstory && (
            <p className="text-xs text-[hsl(var(--dm-text-faint))] italic">
              No traits or backstory recorded yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
