// client/src/components/game/CampaignGameHeader.tsx
//
// Thin immersive header replacing the old dashboard-style campaign bar
// (design spec §3.1). Map/Journal/Party are shell entry points only — none
// of those features exist yet, so they render disabled with a clear reason
// rather than pretending to work (spec §19's "omit or disable with a clear
// reason" rule).

import { ArrowLeft, Map, ScrollText, Users, MoreHorizontal, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  campaignName: string;
  sceneLabel?: string | null;
  connected: boolean;
  onBack: () => void;
  onOpenOptions: () => void;
};

function StubHeaderButton({ icon: Icon, label }: { icon: typeof Map; label: string }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="ghost"
              size="icon"
              disabled
              className="h-8 w-8 text-[hsl(var(--dm-text-faint))] opacity-60"
            >
              <Icon className="w-4 h-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label} — coming soon</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function CampaignGameHeader({ campaignName, sceneLabel, connected, onBack, onOpenOptions }: Props) {
  return (
    <header className="dm-leather border-b h-12 shrink-0 flex items-center justify-between px-3 gap-3 relative z-10">
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back to dashboard">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="dm-heading text-sm font-semibold truncate">{campaignName}</span>
          {sceneLabel && (
            <span className="text-xs dm-amber-text truncate hidden sm:inline">— {sceneLabel}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <StubHeaderButton icon={Map} label="Map" />
        <StubHeaderButton icon={ScrollText} label="Journal / Quests" />
        <StubHeaderButton icon={Users} label="Party" />
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenOptions} aria-label="Options">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Options</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Connection state stays quiet unless there's actually a problem. */}
        <span
          className={`ml-1 flex items-center gap-1 text-[10px] uppercase tracking-wide ${
            connected ? "text-[hsl(var(--dm-text-faint))]" : "dm-danger-text"
          }`}
          title={connected ? "Connected" : "Reconnecting"}
        >
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden md:inline">{connected ? "" : "Reconnecting"}</span>
        </span>
      </div>
    </header>
  );
}
