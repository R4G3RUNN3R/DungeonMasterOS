import type {
  CommunityAchievementActivity,
  NewAdventurerSummary,
} from "@shared/player-profile";
import { Award, Sparkles, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type CommunitySectionProps = {
  recentAchievements: CommunityAchievementActivity[];
  newAdventurers: NewAdventurerSummary[];
};

function IdentityAvatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  return (
    <Avatar className="h-8 w-8 shrink-0 border border-amber-500/30 bg-background/70">
      <AvatarImage src={avatarUrl ?? undefined} alt={`${username}'s avatar`} />
      <AvatarFallback className="bg-amber-500/10 text-xs font-semibold text-amber-300">
        {username.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function EmptyCommunityColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-500/20 bg-background/40 px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function CommunitySection({ recentAchievements, newAdventurers }: CommunitySectionProps) {
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-serif text-xl font-bold text-foreground">Community</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-400" />
            <h3 className="font-serif text-base font-semibold text-foreground">Recent Achievements</h3>
          </div>

          {recentAchievements.length > 0 ? (
            <div className="space-y-2">
              {recentAchievements.map((activity) => (
                <div key={`${activity.username}-${activity.achievement.id}-${activity.unlockedAt}`} className="flex items-center gap-3 rounded-lg bg-background/35 px-3 py-2">
                  <IdentityAvatar username={activity.username} avatarUrl={activity.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">
                      <span className="cursor-pointer font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline">
                        {activity.username}
                      </span>{" "}
                      earned <span className="font-medium text-foreground">{activity.achievement.name}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCommunityColumn>No recent achievements to show yet.</EmptyCommunityColumn>
          )}
        </article>

        <article className="rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner">
          <div className="mb-3 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-amber-400" />
            <h3 className="font-serif text-base font-semibold text-foreground">New Adventurers</h3>
          </div>

          {newAdventurers.length > 0 ? (
            <div className="space-y-2">
              {newAdventurers.map((adventurer) => (
                <div key={`${adventurer.username}-${adventurer.joinedAt}`} className="flex items-center gap-3 rounded-lg bg-background/35 px-3 py-2">
                  <IdentityAvatar username={adventurer.username} avatarUrl={adventurer.avatarUrl} />
                  <p className="truncate text-sm text-muted-foreground">
                    <span className="cursor-pointer font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline">
                      {adventurer.username}
                    </span>{" "}
                    joined the community.
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCommunityColumn>New adventurers will gather here soon.</EmptyCommunityColumn>
          )}
        </article>
      </div>
    </section>
  );
}
