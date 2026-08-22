// client/src/components/game/OptionsDialog.tsx
//
// Top-level Options entry point (design spec's in-game Options/Settings
// system — this is the final integration task of that plan). Two
// independent domains live under one Dialog with top-level tabs:
//
// - Personal: reads/writes directly through usePersonalPreferences()
//   (Task 7) — local-first, hybrid-synced with the server, no network call
//   owned by this file.
// - Campaign: composes CampaignSettingsPanel / CampaignSuggestions /
//   CampaignSettingsHistory (Tasks 8-9), gated on the campaign query's
//   server-sourced `viewerAuthority` field (Task 5). This file never
//   computes ownership itself — it only ever reads that field.
//
// CampaignSettingsHistory does not self-gate on viewerAuthority (a "none"
// viewer gets a 403 from the server that the component currently renders
// as a false "No changes yet."), so it — and its sibling sub-tabs — must
// only ever render once viewerAuthority !== "none". Radix's Tabs.Content
// already unmounts inactive panels (so an inactive sub-tab never fetches),
// but the whole sub-tab block is additionally wrapped in that authority
// check below so the guarantee doesn't depend on that mount behavior.

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Campaign } from "@shared/schema";
import { usePersonalPreferences, type LayoutPreset, type NotificationStyle } from "@/lib/personalPreferences";
import CampaignSettingsPanel from "@/components/CampaignSettingsPanel";
import CampaignSuggestions from "./CampaignSuggestions";
import CampaignSettingsHistory from "./CampaignSettingsHistory";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
}

type ViewerAuthority = "owner" | "player" | "none";
type CampaignWithAuthority = Campaign & { viewerAuthority: ViewerAuthority };

function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      {children}
    </div>
  );
}

export default function OptionsDialog({ open, onOpenChange, campaignId }: Props) {
  const [campaignSubTab, setCampaignSubTab] = useState("settings");
  const { preferences, setLayoutPreset, setReducedMotion, setAchievementToastStyle } = usePersonalPreferences();

  // Same queryKey campaign.tsx's own campaignQuery uses for this campaign
  // (["/api/campaigns", campaignId]) — TanStack Query dedupes by key, so
  // this shares that cache entry rather than issuing a second network
  // request whenever campaign.tsx's query is already fresh.
  const { data: campaign } = useQuery<CampaignWithAuthority>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => (await apiRequest("GET", `/api/campaigns/${campaignId}`)).json(),
    enabled: open && Number.isFinite(campaignId),
  });
  const viewerAuthority: ViewerAuthority = campaign?.viewerAuthority ?? "none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogTitle>Options</DialogTitle>

        <Tabs defaultValue="personal">
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="campaign">Campaign</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-5">
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display</h3>
              <OptionRow label="Layout">
                <Select
                  value={preferences.display.layoutPreset}
                  onValueChange={(v) => setLayoutPreset(v as LayoutPreset)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wide">Wide</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="cinematic">Cinematic</SelectItem>
                  </SelectContent>
                </Select>
              </OptionRow>
              <OptionRow label="Reduced motion">
                <Switch checked={preferences.display.reducedMotion} onCheckedChange={(v) => setReducedMotion(v)} />
              </OptionRow>
            </section>

            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</h3>
              <OptionRow label="Achievement toasts">
                <Select
                  value={preferences.notifications.achievementToasts}
                  onValueChange={(v) => setAchievementToastStyle(v as NotificationStyle)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </OptionRow>
            </section>
          </TabsContent>

          <TabsContent value="campaign" className="space-y-3">
            {!campaign ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : viewerAuthority === "none" ? (
              <p className="text-sm text-muted-foreground">You are not a participant in this campaign.</p>
            ) : (
              <Tabs value={campaignSubTab} onValueChange={setCampaignSubTab}>
                <TabsList>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="settings">
                  <CampaignSettingsPanel campaign={campaign} viewerAuthority={viewerAuthority} campaignId={campaignId} />
                </TabsContent>
                <TabsContent value="suggestions">
                  <CampaignSuggestions campaignId={campaignId} viewerAuthority={viewerAuthority} />
                </TabsContent>
                <TabsContent value="history">
                  <CampaignSettingsHistory campaignId={campaignId} />
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
