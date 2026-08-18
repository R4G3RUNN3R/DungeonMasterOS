// client/src/components/game/StoryMessage.tsx
//
// One entry in the story chronicle (design spec §6). DM narration is wide
// and visually dominant; player actions are offset/right-aligned and
// smaller; system messages stay quiet so they never compete with the story.

import { Sparkles, Sword } from "lucide-react";

type Message = {
  id: number;
  sender: string;
  senderType: "dm" | "player" | "system";
  content: string;
  messageType: string;
};

// Last-resort client-side guard (2026-08-18 incident: a [WORLD_STATE] block
// reached a player's chat verbatim — see server/internal-tag-guard.ts for
// the real, server-side fix). This is NOT the fix; it exists only so that
// if a server regression or an AI provider quirk ever lets a recognized
// internal protocol tag through anyway, the player still never sees it.
// Mirrors the server's tag vocabulary and same fail-closed rule: an
// unmatched marker truncates the message rather than ever being shown.
const INTERNAL_TAG_NAMES = [
  "WORLD_STATE", "CHECK", "COMBAT_START", "ATTACK", "SURRENDER",
  "TITLE_CANDIDATE", "TITLE_WITNESS", "SHOP",
];
const TAG_DETECTOR = new RegExp(`\\[/?(?:${INTERNAL_TAG_NAMES.join("|")})\\]`, "i");

function sanitizeForDisplay(content: string): string {
  let result = content;
  for (const name of INTERNAL_TAG_NAMES) {
    result = result.replace(
      new RegExp(`[*_]{0,2}\\[${name}\\][*_]{0,2}[\\s\\S]*?[*_]{0,2}\\[/${name}\\][*_]{0,2}`, "gi"),
      "",
    );
  }
  const leakIndex = result.search(TAG_DETECTOR);
  if (leakIndex !== -1) {
    console.error("[StoryMessage] internal protocol tag marker reached the client — truncating before it");
    result = result.slice(0, leakIndex);
  }
  return result.trim();
}

function renderContent(content: string) {
  return sanitizeForDisplay(content).split(/\n/g).map((line, index) => (
    <p key={index} className="whitespace-pre-wrap leading-relaxed">
      {line}
    </p>
  ));
}

export default function StoryMessage({ message }: { message: Message }) {
  if (message.senderType === "system") {
    return (
      <div className="max-w-2xl mx-auto text-center text-xs text-[hsl(var(--dm-parchment-muted))] italic py-1">
        {message.content}
      </div>
    );
  }

  if (message.senderType === "player") {
    return (
      <div className="max-w-xl ml-auto">
        <div className="dm-leather text-[hsl(var(--dm-text))] rounded-lg rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] dm-amber-text mb-1 font-medium">
            <Sword className="w-3 h-3" />
            {message.sender}
          </div>
          <div className="space-y-1">{renderContent(message.content)}</div>
        </div>
      </div>
    );
  }

  // DM narration — wide, dominant, parchment-toned.
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[hsl(var(--dm-parchment-muted))] mb-1.5">
        <Sparkles className="w-3.5 h-3.5 dm-amber-text" />
        <span className="dm-heading not-italic font-semibold text-[hsl(var(--dm-parchment-ink))]">
          {message.sender}
        </span>
      </div>
      <div className="dm-heading text-[15px] leading-[1.75] text-[hsl(var(--dm-parchment-ink))] space-y-3">
        {renderContent(message.content)}
      </div>
    </div>
  );
}
