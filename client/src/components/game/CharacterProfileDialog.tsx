// client/src/components/game/CharacterProfileDialog.tsx
//
// Entry point opened by the HUD portrait (design spec §5), presented as an
// illuminated portrait-card/manuscript (spec §12.5) — parchment ground,
// double bronze border, ornamented portrait frame. What's shown here is
// real: identity plus the character's own traits/backstory text, which
// already exist as live fields. The richer profile (scars, affiliations,
// earned titles) described in the spec is future work that depends on
// systems this branch doesn't have yet.

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="dm-shell dm-illuminated max-w-lg max-h-[80vh] overflow-y-auto dm-scroll p-0">
        <div className="px-7 pt-7 pb-5 text-center border-b border-[hsl(var(--dm-parchment-line))]">
          <span
            className="inline-flex w-20 h-20 rounded-full items-center justify-center mx-auto mb-3"
            style={{
              background: "hsl(var(--dm-parchment))",
              boxShadow: "0 0 0 2px hsl(var(--dm-parchment)), 0 0 0 4px hsl(var(--dm-bronze)), 0 0 0 5px hsl(var(--dm-parchment-line))",
            }}
          >
            {hud.portraitUrl ? (
              <img src={hud.portraitUrl} alt={hud.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-2xl dm-heading" style={{ color: "hsl(var(--dm-bronze))" }}>
                {hud.name.slice(0, 1).toUpperCase() || "?"}
              </span>
            )}
          </span>
          <DialogTitle className="dm-heading text-xl font-semibold">{hud.name}</DialogTitle>
          <div className="text-sm mt-0.5" style={{ color: "hsl(var(--dm-parchment-muted))" }}>
            {hud.race ?? "Unknown race"} · {hud.classSummary ?? "Unknown class"}
          </div>
        </div>

        <div className="px-7 py-5 space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="dm-heading text-[0.68rem] uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>Age</div>
              <div>{hud.age ?? "Unknown"}</div>
            </div>
            <div>
              <div className="dm-heading text-[0.68rem] uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>Alignment</div>
              <div>{hud.alignment ?? "Unknown"}</div>
            </div>
          </div>

          {traits && (
            <div>
              <div className="dm-heading text-[0.68rem] uppercase tracking-wide mb-1" style={{ color: "hsl(var(--dm-bronze))" }}>Traits</div>
              <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "hsl(var(--dm-parchment-muted))" }}>{traits}</p>
            </div>
          )}

          {backstory && (
            <div>
              <div className="dm-heading text-[0.68rem] uppercase tracking-wide mb-1" style={{ color: "hsl(var(--dm-bronze))" }}>Backstory</div>
              <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "hsl(var(--dm-parchment-muted))" }}>{backstory}</p>
            </div>
          )}

          {!traits && !backstory && (
            <p className="text-xs italic" style={{ color: "hsl(var(--dm-parchment-muted))" }}>
              No traits or backstory recorded yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
