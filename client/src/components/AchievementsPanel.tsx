import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ACHIEVEMENTS, type AchievementCategory } from "@shared/achievements";

type UnlockedAchievement = {
  achievementId: string;
  unlockedAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  character: "Character",
  combat: "Combat",
  social: "Social",
  exploration: "Exploration",
  meta: "Meta",
  secret: "Secret",
};

const CATEGORY_ORDER: AchievementCategory[] = ["character", "combat", "social", "exploration", "meta", "secret"];

export default function AchievementsPanel({ open, onOpenChange }: Props) {
  const { data: unlocked } = useQuery<UnlockedAchievement[]>({
    queryKey: ["/api/achievements"],
    enabled: open,
  });

  const unlockedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of unlocked ?? []) map.set(u.achievementId, u.unlockedAt);
    return map;
  }, [unlocked]);

  const byCategory = useMemo(() => {
    const groups = new Map<AchievementCategory, typeof ACHIEVEMENTS>();
    for (const a of ACHIEVEMENTS) {
      // Hidden + not-yet-unlocked achievements stay off the list entirely —
      // that's the whole point of "hidden" (a surprise on unlock).
      if (a.hidden && !unlockedMap.has(a.id)) continue;
      const list = groups.get(a.category) ?? [];
      list.push(a);
      groups.set(a.category, list);
    }
    return groups;
  }, [unlockedMap]);

  const totalUnlocked = unlockedMap.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600" />
            Deeds & Achievements
            <span className="text-sm font-normal text-muted-foreground">
              {totalUnlocked} / {ACHIEVEMENTS.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-6 pb-2">
            {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
              <div key={cat} className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {byCategory.get(cat)!.map((a) => {
                    const isUnlocked = unlockedMap.has(a.id);
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "rounded-lg border p-3 flex items-start gap-3",
                          isUnlocked ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/20 opacity-60",
                        )}
                      >
                        <div className="text-xl leading-none mt-0.5">{a.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-medium text-sm">{a.name}</div>
                            {a.rewardTurns ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">
                                +{a.rewardTurns} Turns
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                          {isUnlocked && (
                            <div className="text-[10px] text-amber-600/80 mt-1">
                              Unlocked {new Date(unlockedMap.get(a.id)!).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
