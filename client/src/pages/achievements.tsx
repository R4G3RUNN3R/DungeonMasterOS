import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import type { AchievementCategory } from "@shared/achievements";
import type { UserAchievement } from "@shared/schema";
import {
  EMPTY_ACHIEVEMENTS_PAGE_MODEL,
  type AchievementsPageModel,
  type PublicAchievementSummary,
  calculateTurnsEarned,
  normalizeShowcaseSelection,
  visibleAchievementDefinitions,
} from "@shared/player-profile";

import { useAuth } from "@/hooks/use-auth";
import { getQueryFn } from "@/lib/queryClient";
import { AchievementMedalCard } from "@/components/profile/AchievementMedalCard";
import { AchievementShowcase } from "@/components/profile/AchievementShowcase";
import { AchievementShowcaseSelector } from "@/components/profile/AchievementShowcaseSelector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AchievementsPageProps = {
  model?: AchievementsPageModel;
};

type AchievementFilter = "all" | Exclude<AchievementCategory, "secret">;

const FILTERS: Array<{ id: AchievementFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "character", label: "Character" },
  { id: "combat", label: "Combat" },
  { id: "social", label: "Social" },
  { id: "exploration", label: "Exploration" },
  { id: "meta", label: "Meta" },
];

function toPublicAchievementSummary(
  definition: ReturnType<typeof visibleAchievementDefinitions>[number],
  unlockedAchievementIds: ReadonlySet<string>,
): PublicAchievementSummary {
  const rewardTurns = definition.rewardTurns ?? 0;

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    category: definition.category,
    unlocked: unlockedAchievementIds.has(definition.id),
    ...(rewardTurns > 0 ? { rewardTurns } : {}),
  };
}

export function AchievementsPage({ model = EMPTY_ACHIEVEMENTS_PAGE_MODEL }: AchievementsPageProps) {
  const [activeFilter, setActiveFilter] = useState<AchievementFilter>("all");
  const [editShowcaseOpen, setEditShowcaseOpen] = useState(false);
  const [localShowcaseIds, setLocalShowcaseIds] = useState<string[]>(() => normalizeShowcaseSelection(model.showcasedAchievementIds));

  const unlockedAchievementIds = useMemo(() => new Set(model.unlockedAchievementIds), [model.unlockedAchievementIds]);
  const visibleAchievements = useMemo(
    () => visibleAchievementDefinitions(unlockedAchievementIds),
    [unlockedAchievementIds],
  );
  const achievementSummaries = useMemo(
    () => visibleAchievements.map((achievement) => toPublicAchievementSummary(achievement, unlockedAchievementIds)),
    [unlockedAchievementIds, visibleAchievements],
  );
  const hiddenAchievementIds = useMemo(
    () => new Set(visibleAchievements.filter((achievement) => achievement.hidden).map((achievement) => achievement.id)),
    [visibleAchievements],
  );
  const unlockedAchievements = achievementSummaries.filter((achievement) => achievement.unlocked);
  const selectedShowcase = localShowcaseIds.flatMap(
    (id) => unlockedAchievements.find((achievement) => achievement.id === id) ?? [],
  );
  const filteredAchievements = activeFilter === "all"
    ? achievementSummaries
    : achievementSummaries.filter(
      (achievement) => achievement.category === activeFilter && !hiddenAchievementIds.has(achievement.id),
    );
  const progress = visibleAchievements.length === 0
    ? 0
    : Math.round((unlockedAchievements.length / visibleAchievements.length) * 100);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-xl border border-amber-500/25 bg-card/60 p-5 shadow-inner sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-300/80">Collection</p>
              <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Achievements</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {unlockedAchievements.length} of {visibleAchievements.length} visible honours earned
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/25 bg-background/55 px-4 py-3 sm:min-w-44">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Turns Earned</p>
              <p className="mt-1 flex items-center gap-2 font-serif text-2xl font-semibold">
                <Award className="h-5 w-5 text-amber-400" />
                {model.turnsEarned}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Collection progress</span>
              <span>{progress}%</span>
            </div>
            <div
              aria-label="Achievement collection progress"
              aria-valuemax={visibleAchievements.length}
              aria-valuemin={0}
              aria-valuenow={unlockedAchievements.length}
              aria-valuetext={`${unlockedAchievements.length} of ${visibleAchievements.length} visible achievements earned`}
              className="h-2 overflow-hidden rounded-full border border-amber-500/20 bg-background/70"
              role="progressbar"
            >
              <div className="h-full rounded-full bg-amber-500/75 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <AchievementShowcase
          achievements={selectedShowcase}
          editable={model.viewerIsOwner}
          onEdit={model.viewerIsOwner ? () => setEditShowcaseOpen(true) : undefined}
        />

        <section className="rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-lg font-semibold">Collection</h2>
              <p className="mt-1 text-xs text-muted-foreground">Recorded deeds and the honours they have earned.</p>
            </div>
            <div aria-label="Achievement category filters" className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-8 border-amber-500/25 px-3 text-xs",
                    activeFilter === filter.id && "border-amber-400/60 bg-amber-500/10 text-amber-200",
                  )}
                  aria-pressed={activeFilter === filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredAchievements.map((achievement) => (
              <AchievementMedalCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </section>
      </div>

      {model.viewerIsOwner ? (
        <AchievementShowcaseSelector
          open={editShowcaseOpen}
          achievements={unlockedAchievements}
          selectedIds={localShowcaseIds}
          onOpenChange={setEditShowcaseOpen}
          onSave={(selectedIds) => setLocalShowcaseIds(normalizeShowcaseSelection(selectedIds))}
        />
      ) : null}
    </main>
  );
}

// Route-level container: wires the presentational AchievementsPage above to
// real, already-existing backend data (GET /api/achievements) via this app's
// established react-query pattern. A persisted showcase selection has no
// backend support yet, so it starts as a real, honest empty state rather
// than an invented default — the owner can still build one locally via the
// existing AchievementShowcaseSelector, exactly as before.
export default function AchievementsRoute() {
  const { user, isLoading: userLoading } = useAuth();
  const { data: userAchievements, isLoading: achievementsLoading } = useQuery<UserAchievement[]>({
    queryKey: ["/api/achievements"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  if (userLoading || (!!user && achievementsLoading)) {
    return <main className="min-h-screen bg-background" />;
  }

  const unlockedAchievementIds = (userAchievements ?? []).map((a) => a.achievementId);
  const model: AchievementsPageModel = {
    unlockedAchievementIds,
    showcasedAchievementIds: [],
    turnsEarned: calculateTurnsEarned(unlockedAchievementIds),
    viewerIsOwner: !!user,
  };

  return <AchievementsPage model={model} />;
}
