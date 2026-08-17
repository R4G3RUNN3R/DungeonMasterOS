// client/src/components/game/StoryChronicle.tsx
//
// Central story region (design spec §6). Renders on a parchment reading
// surface so DM narration stays comfortably readable even inside a wide
// gameplay column — text line length is bounded by StoryMessage's own
// max-width, not by the column itself.

import { forwardRef } from "react";
import { Loader2, ScrollText } from "lucide-react";
import StoryMessage from "./StoryMessage";

type Message = {
  id: number;
  sender: string;
  senderType: "dm" | "player" | "system";
  content: string;
  messageType: string;
};

type Props = {
  messages: Message[];
  dmThinking: boolean;
};

const StoryChronicle = forwardRef<HTMLDivElement, Props>(function StoryChronicle({ messages, dmThinking }, ref) {
  return (
    <div className="flex-1 min-h-0 dm-parchment relative">
      <div className="absolute inset-0 overflow-y-auto dm-scroll">
        <div ref={ref} className="max-w-4xl mx-auto px-6 sm:px-10 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto text-center py-12">
              <ScrollText className="w-8 h-8 mx-auto mb-3 text-[hsl(var(--dm-parchment-muted))]" />
              <div className="dm-heading text-lg font-semibold text-[hsl(var(--dm-parchment-ink))]">
                Your campaign is ready.
              </div>
              <p className="text-sm text-[hsl(var(--dm-parchment-muted))] mt-1">
                Begin the adventure below when you're ready.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <StoryMessage key={message.id} message={message} />
          ))}

          {dmThinking && (
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--dm-parchment-muted))] italic">
              <Loader2 className="w-4 h-4 animate-spin" />
              The Dungeon Master is thinking...
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default StoryChronicle;
