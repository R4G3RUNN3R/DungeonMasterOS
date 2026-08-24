import type { PublicAchievementSummary } from "@shared/player-profile";

import { cn } from "@/lib/utils";

export type AchievementMedalCardProps = {
  achievement: PublicAchievementSummary;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

export function AchievementMedalCard({
  achievement,
  compact = false,
  selected = false,
  onClick,
}: AchievementMedalCardProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-background/70 text-xl",
          compact ? "h-10 w-10" : "h-12 w-12",
          !achievement.unlocked && "opacity-45 grayscale",
        )}
      >
        {achievement.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-serif text-sm font-semibold text-foreground">
            {achievement.name}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {achievement.unlocked ? "Earned" : "Locked"}
          </span>
        </span>
        {!compact && (
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {achievement.description}
          </span>
        )}
        {achievement.rewardTurns && achievement.rewardTurns > 0 ? (
          <span className="mt-2 block text-xs font-medium text-primary">
            +{achievement.rewardTurns} Turns
          </span>
        ) : null}
      </span>
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 rounded-lg border bg-card/70 p-3 text-left shadow-inner",
    "border-amber-500/25",
    selected && "border-primary bg-primary/10 ring-1 ring-primary/35",
    onClick && "cursor-pointer transition-colors hover:border-primary/60 hover:bg-card",
    !achievement.unlocked && "opacity-70",
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        aria-pressed={selected}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
