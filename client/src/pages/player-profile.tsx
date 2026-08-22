import { useState } from "react";
import type { PublicAchievementSummary, PublicPlayerProfileSummary } from "@shared/player-profile";
import { Award, Pencil, Sparkles, UserRound } from "lucide-react";

import { AchievementShowcase } from "@/components/profile/AchievementShowcase";
import { AchievementShowcaseSelector } from "@/components/profile/AchievementShowcaseSelector";
import { MostRecentCharacterCard } from "@/components/profile/MostRecentCharacterCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PlayerProfilePageProps = {
  profile?: PublicPlayerProfileSummary | null;
  /** Owner-only selector candidates. This does not change the public profile contract. */
  unlockedAchievements?: PublicAchievementSummary[];
};

type LocalProfileEdits = {
  username: string;
  avatarUrl: string | null;
};

function memberSinceYear(memberSince: string): number | null {
  const year = new Date(memberSince).getFullYear();
  return Number.isFinite(year) ? year : null;
}

export default function PlayerProfilePage({
  profile,
  unlockedAchievements,
}: PlayerProfilePageProps) {
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editShowcaseOpen, setEditShowcaseOpen] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");
  const [localProfileEdits, setLocalProfileEdits] = useState<LocalProfileEdits | null>(null);
  const [localShowcaseIds, setLocalShowcaseIds] = useState<string[] | null>(null);

  if (!profile) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <div className="mx-auto max-w-xl rounded-xl border border-amber-500/25 bg-card/60 p-8 text-center shadow-inner">
          <Sparkles className="mx-auto h-7 w-7 text-amber-400" />
          <h1 className="mt-4 font-serif text-2xl font-semibold">Player profile</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This profile is ready for its public data connection.
          </p>
        </div>
      </main>
    );
  }

  const displayedUsername = localProfileEdits?.username ?? profile.username;
  const displayedAvatarUrl = localProfileEdits?.avatarUrl ?? profile.avatarUrl;
  const selectedShowcase = localShowcaseIds
    ? localShowcaseIds.flatMap((id) => unlockedAchievements?.find((achievement) => achievement.id === id) ?? [])
    : profile.showcasedAchievements;
  const joinedYear = memberSinceYear(profile.memberSince);

  const openProfileEditor = () => {
    setDraftUsername(displayedUsername);
    setDraftAvatarUrl(displayedAvatarUrl ?? "");
    setEditProfileOpen(true);
  };

  const saveProfileEdits = () => {
    setLocalProfileEdits({
      username: draftUsername.trim() || profile.username,
      avatarUrl: draftAvatarUrl.trim() || null,
    });
    setEditProfileOpen(false);
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-xl border border-amber-500/25 bg-card/60 p-5 shadow-inner sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-16 w-16 border border-amber-500/30 bg-background/70">
                <AvatarImage src={displayedAvatarUrl ?? undefined} alt={`${displayedUsername}'s avatar`} />
                <AvatarFallback className="bg-amber-500/10 text-amber-300">
                  <UserRound className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate font-serif text-2xl font-semibold tracking-tight">{displayedUsername}</h1>
                {joinedYear ? <p className="mt-1 text-sm text-muted-foreground">Member since {joinedYear}</p> : null}
              </div>
            </div>
            {profile.viewerIsOwner ? (
              <Button type="button" variant="outline" className="shrink-0 border-amber-500/30" onClick={openProfileEditor}>
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Button>
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Achievements</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{profile.achievementsUnlocked}</p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Turns Earned</p>
            <p className="mt-2 flex items-center gap-2 font-serif text-2xl font-semibold">
              <Award className="h-5 w-5 text-amber-400" />
              {profile.turnsEarned}
            </p>
          </div>
        </section>

        <AchievementShowcase
          achievements={selectedShowcase}
          editable={profile.viewerIsOwner}
          onEdit={profile.viewerIsOwner ? () => setEditShowcaseOpen(true) : undefined}
        />

        <section className="rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner">
          <h2 className="font-serif text-base font-semibold text-foreground">Most Recent Character</h2>
          <div className="mt-4">
            {profile.mostRecentCharacter ? (
              <MostRecentCharacterCard character={profile.mostRecentCharacter} />
            ) : (
              <p className="rounded-lg border border-dashed border-amber-500/25 bg-background/55 px-4 py-8 text-center text-sm text-muted-foreground">
                No character is available to display.
              </p>
            )}
          </div>
        </section>
      </div>

      {profile.viewerIsOwner ? (
        <>
          <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
            <DialogContent className="border-amber-500/30 bg-card">
              <DialogHeader>
                <DialogTitle className="font-serif">Edit Profile</DialogTitle>
                <DialogDescription>These changes are local to this unwired profile preview.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-username">Username</Label>
                  <Input id="profile-username" value={draftUsername} onChange={(event) => setDraftUsername(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-avatar-url">Avatar URL</Label>
                  <Input
                    id="profile-avatar-url"
                    type="url"
                    value={draftAvatarUrl}
                    onChange={(event) => setDraftAvatarUrl(event.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditProfileOpen(false)}>Cancel</Button>
                <Button type="button" onClick={saveProfileEdits}>Save Locally</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AchievementShowcaseSelector
            open={editShowcaseOpen}
            achievements={unlockedAchievements ?? []}
            selectedIds={localShowcaseIds ?? profile.showcasedAchievements.map((achievement) => achievement.id)}
            onOpenChange={setEditShowcaseOpen}
            onSave={setLocalShowcaseIds}
          />
        </>
      ) : null}
    </main>
  );
}
