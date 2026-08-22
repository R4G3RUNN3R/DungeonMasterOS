import { useEffect, useState } from "react";
import type { PublicAchievementSummary } from "@shared/player-profile";

import { AchievementMedalCard } from "@/components/profile/AchievementMedalCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AchievementShowcaseSelectorProps = {
  open: boolean;
  achievements: PublicAchievementSummary[];
  selectedIds: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (selectedIds: string[]) => void;
};

function normalizeSelection(ids: string[]): string[] {
  return [...new Set(ids)].slice(0, 3);
}

export function AchievementShowcaseSelector({
  open,
  achievements,
  selectedIds,
  onOpenChange,
  onSave,
}: AchievementShowcaseSelectorProps) {
  const [pendingSelection, setPendingSelection] = useState(() => normalizeSelection(selectedIds));

  useEffect(() => {
    if (open) {
      setPendingSelection(normalizeSelection(selectedIds));
    }
  }, [open, selectedIds]);

  const toggleAchievement = (id: string) => {
    setPendingSelection((currentSelection) => {
      if (currentSelection.includes(id)) {
        return currentSelection.filter((selectedId) => selectedId !== id);
      }

      if (currentSelection.length === 3) {
        return currentSelection;
      }

      return [...currentSelection, id];
    });
  };

  const saveSelection = () => {
    onSave(pendingSelection);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-amber-500/30 bg-card">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Achievement Showcase</DialogTitle>
          <DialogDescription>
            Select up to three earned honours for your public profile.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-amber-500/25 bg-background/60 px-3 py-2 text-xs">
          <span className="font-medium text-foreground">Showcase selection</span>
          <span className="text-muted-foreground">{pendingSelection.length} / 3 selected</span>
        </div>

        {achievements.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {achievements.map((achievement) => (
              <AchievementMedalCard
                key={achievement.id}
                achievement={achievement}
                compact
                selected={pendingSelection.includes(achievement.id)}
                onClick={() => toggleAchievement(achievement.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-amber-500/25 bg-background/55 px-4 py-8 text-center">
            <p className="font-serif text-sm font-medium text-foreground">No earned achievements yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Return after your next notable deed to choose a showcase.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={saveSelection}>
            Save Showcase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
