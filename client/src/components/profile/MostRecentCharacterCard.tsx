import type { PublicCharacterSummary } from "@shared/player-profile";
import { UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type MostRecentCharacterCardProps = {
  character: PublicCharacterSummary;
};

/** A deliberately limited public snapshot of a player's latest character. */
export function MostRecentCharacterCard({ character }: MostRecentCharacterCardProps) {
  return (
    <article className="flex items-center gap-4 rounded-xl border border-amber-500/25 bg-card/60 p-4 shadow-inner">
      <Avatar className="h-14 w-14 border border-amber-500/30 bg-background/70">
        <AvatarImage src={character.portraitUrl ?? undefined} alt={`${character.name}'s portrait`} />
        <AvatarFallback className="bg-amber-500/10 text-amber-300">
          <UserRound className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-lg font-semibold text-foreground">{character.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{character.identityLabel}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{character.progressionLabel}</span>
          <span aria-hidden="true"> · </span>
          {character.progressionValue}
        </p>
      </div>
    </article>
  );
}
