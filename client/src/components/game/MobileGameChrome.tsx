// client/src/components/game/MobileGameChrome.tsx
//
// Mobile shell (design spec §11). Story fills the screen; Character and
// Context become bottom sheets instead of permanent desktop columns. This
// renders alongside the desktop shell and is toggled purely via the `lg:`
// breakpoint — the same CSS-driven responsive pattern already used
// elsewhere in this codebase, not JS viewport detection.

import { useState } from "react";
import type { ReactNode } from "react";
import { User, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type Props = {
  characterHud: ReactNode;
  contextPanel: ReactNode;
  contextLabel: string;
};

export default function MobileGameChrome({ characterHud, contextPanel, contextLabel }: Props) {
  const [sheet, setSheet] = useState<"character" | "context" | null>(null);

  return (
    <div className="lg:hidden dm-leather border-t flex items-stretch shrink-0">
      <Button
        variant="ghost"
        className="flex-1 h-11 rounded-none flex items-center justify-center gap-2 text-[hsl(var(--dm-text-muted))]"
        onClick={() => setSheet("character")}
      >
        <User className="w-4 h-4" />
        <span className="text-xs">Character</span>
      </Button>
      <div className="w-px dm-divider border-l" />
      <Button
        variant="ghost"
        className="flex-1 h-11 rounded-none flex items-center justify-center gap-2 text-[hsl(var(--dm-text-muted))]"
        onClick={() => setSheet("context")}
      >
        <Compass className="w-4 h-4" />
        <span className="text-xs">{contextLabel}</span>
      </Button>

      <Sheet open={sheet === "character"} onOpenChange={(open) => setSheet(open ? "character" : null)}>
        <SheetContent side="bottom" className="dm-shell p-0 h-[80vh] border-[hsl(var(--dm-line))]">
          {characterHud}
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === "context"} onOpenChange={(open) => setSheet(open ? "context" : null)}>
        <SheetContent side="bottom" className="dm-shell p-0 h-[70vh] border-[hsl(var(--dm-line))]">
          {contextPanel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
