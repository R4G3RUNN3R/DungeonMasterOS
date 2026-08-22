import type { PublicAchievementSummary } from "@shared/player-profile";
import { Pencil } from "lucide-react";

import { AchievementMedalCard } from "@/components/profile/AchievementMedalCard";
import { Button } from "@/components/ui/button";

export type AchievementShowcaseProps = {
  achievements: PublicAchievementSummary[];
  editable?: boolean;
  onEdit?: () => void;
};

export function AchievementShowcase({
  achievements,
  editable = false,
  onEdit,
}: AchievementShowcaseProps) {
  const showcasedAchievements = achievements.slice(0, 3);

  return (
    <section className="rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">Achievement Showcase</h2>
          <p className="mt-1 text-xs text-muted-foreground">Honours carried into the hall.</p>
        </div>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-500/30 text-xs"
            onClick={onEdit}
            disabled={!onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Showcase
          </Button>
        )}
      </div>

      {showcasedAchievements.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {showcasedAchievements.map((achievement) => (
            <AchievementMedalCard key={achievement.id} achievement={achievement} compact />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-amber-500/25 bg-background/55 px-4 py-8 text-center">
          <p className="font-serif text-sm font-medium text-foreground">No achievements on display</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Select up to three earned honours to make this profile your own.
          </p>
        </div>
      )}
    </section>
  );
}
