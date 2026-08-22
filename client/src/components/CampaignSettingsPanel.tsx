/**
 * CampaignSettingsPanel — live mid-campaign settings editor
 *
 * Host-only. All settings can be changed mid-campaign with a warning
 * that it will alter the DM's behaviour from the next response onward.
 *
 * Settings that are "tone-altering" (tone, power level, world genesis,
 * anime source) show a strong orange warning.
 * Settings that are "safe" (story mode on/off, combat style, rules weight)
 * show only a mild informational note.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";
import { AlertTriangle, ChevronDown, ChevronUp, Check, Lock, Unlock } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ── Option types ──────────────────────────────────────────────────────────

export interface SettingOption { value: string; label: string; description: string }

// Exported so CampaignSuggestions.tsx's "suggest a change" value picker can
// reuse the exact same value/label pairs rather than maintaining a second,
// driftable source of truth for these four enum settings.
export const TONE_OPTIONS: SettingOption[] = [
  { value: "dark",      label: "Dark & Grim",    description: "Harsh consequences, moral grey, death is real" },
  { value: "heroic",    label: "Heroic & Epic",  description: "Triumph, glory, heroes rising to challenges" },
  { value: "comedic",   label: "Comedic",        description: "Wit, absurdity, irony — stakes still matter" },
  { value: "realistic", label: "Realistic",      description: "Survival, politics, human drama, rare magic" },
];

export const COMBAT_OPTIONS: SettingOption[] = [
  { value: "cinematic", label: "Cinematic",        description: "Pure prose, no numbers, dramatic storytelling" },
  { value: "tactical",  label: "Tactical",         description: "Positioning & action economy, still narrative" },
  { value: "dice",      label: "Full Dice (D&D 5e)", description: "All rolls reported, HP, initiative, spell slots" },
];

export const RULES_OPTIONS: SettingOption[] = [
  { value: "light",  label: "Light",  description: "Story over mechanics, narrative outcomes" },
  { value: "medium", label: "Medium", description: "Simple checks when uncertain, balanced" },
  { value: "crunchy", label: "Crunchy", description: "Full D&D 5e — spell slots, attunement, exhaustion" },
];

export const POWER_OPTIONS: SettingOption[] = [
  { value: "low",      label: "Low Fantasy",  description: "A single ogre is a genuine threat" },
  { value: "standard", label: "Standard",     description: "Magic exists, party grows in power over time" },
  { value: "high",     label: "High Fantasy", description: "Powerful spells and legendary items expected" },
  { value: "godtier",  label: "God-Tier",     description: "Demigod power, cosmic-scale threats" },
];

// Which changes are "dramatic" (warrant strong warning)
const DRAMATIC_KEYS = new Set(["tone", "powerLevel", "worldGenStyle"]);

// ── Warning levels ────────────────────────────────────────────────────────
type WarnLevel = "safe" | "moderate" | "dramatic";

function warnLevel(key: string): WarnLevel {
  if (DRAMATIC_KEYS.has(key)) return "dramatic";
  if (key === "combatStyle" || key === "rulesWeight") return "moderate";
  return "safe"; // storyMode, epicMode
}

const WARN_TEXT: Record<WarnLevel, { color: string; bg: string; border: string; icon: string; message: string }> = {
  safe: {
    color: "#1a5c1a", bg: "#1a5c1a12", border: "#1a5c1a44",
    icon: "✓",
    message: "Safe to change mid-campaign. Takes effect on the next DM response.",
  },
  moderate: {
    color: "#b8880a", bg: "#b8880a12", border: "#b8880a44",
    icon: "!",
    message: "This will change how combat is described from this scene onward. Current scene may feel inconsistent briefly.",
  },
  dramatic: {
    color: "#8b1a1a", bg: "#8b1a1a12", border: "#8b1a1a44",
    icon: "⚠",
    message: "This is a dramatic change. The world's tone, power scale, or rules of reality will shift from the next scene. Characters, NPCs, and events already established remain — but the DM will interpret them through the new lens. This can feel jarring if applied suddenly.",
  },
};

// ── Confirmation modal ────────────────────────────────────────────────────
interface ConfirmProps {
  settingLabel: string;
  oldValue: string;
  newValue: string;
  level: WarnLevel;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ settingLabel, oldValue, newValue, level, onConfirm, onCancel }: ConfirmProps) {
  const w = WARN_TEXT[level];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent
        className="max-w-sm bg-gradient-to-br from-[#1a1108] to-[#0d0b06] border-2"
        style={{ borderColor: w.border, boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px ${w.border}` }}
      >
        <DialogTitle className="sr-only">Change {settingLabel}?</DialogTitle>
        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: w.bg, border: `2px solid ${w.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: w.color, fontWeight: 900,
            flexShrink: 0,
          }}>
            {w.icon}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#f4e9c9", fontFamily: "serif", letterSpacing: "0.04em" }}>
              Change {settingLabel}?
            </div>
            <div style={{ fontSize: 9.5, color: "#8a6830", fontFamily: "serif", marginTop: 1 }}>
              This takes effect on the next DM response
            </div>
          </div>
        </div>

        {/* Change summary */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6, padding: "8px 12px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 10, color: "#8a6830", fontFamily: "serif", textDecoration: "line-through" }}>{oldValue}</span>
          <span style={{ color: "#4a2e0e", fontSize: 10 }}>→</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#c4a265", fontFamily: "serif" }}>{newValue}</span>
        </div>

        {/* Warning text */}
        <div style={{
          background: w.bg, border: `1px solid ${w.border}`,
          borderRadius: 6, padding: "8px 10px", marginBottom: 16,
          fontSize: 9.5, color: w.color, fontFamily: "serif", lineHeight: 1.5,
        }}>
          {w.message}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel}
            style={{
              flex: 1, padding: "8px", borderRadius: 6, cursor: "pointer",
              background: "transparent", border: "1px solid #4a2e0e66",
              color: "#8a6830", fontSize: 11, fontFamily: "serif", fontWeight: 700,
            }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{
              flex: 2, padding: "8px", borderRadius: 6, cursor: "pointer",
              background: `linear-gradient(135deg, ${w.color}33, ${w.color}22)`,
              border: `1px solid ${w.color}88`,
              color: w.color, fontSize: 11, fontFamily: "serif", fontWeight: 800,
              letterSpacing: "0.04em",
            }}>
            Yes, change it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────
interface SettingRowProps {
  label: string;
  settingKey: string;
  current: string | boolean;
  options?: SettingOption[];
  isToggle?: boolean;
  toggleLabel?: string;
  toggleDescription?: string;
  isHost: boolean;
  onRequest: (key: string, newVal: string | boolean, oldLabel: string, newLabel: string) => void;
}

function SettingRow({ label, settingKey, current, options, isToggle, toggleLabel, toggleDescription, isHost, onRequest }: SettingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const level = warnLevel(settingKey);
  const w = WARN_TEXT[level];

  if (isToggle) {
    const active = current === true || current === "true";
    return (
      <div style={{ padding: "6px 0", borderBottom: "1px solid rgba(196,162,101,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#c4a87a", fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {label}
            </div>
            {toggleDescription && (
              <div style={{ fontSize: 8, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic", marginTop: 1 }}>
                {toggleDescription}
              </div>
            )}
          </div>
          {isHost ? (
            <button
              onClick={() => onRequest(settingKey, !active, active ? "On" : "Off", active ? "Off" : "On")}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                background: active ? "#1a5c1a" : "#2a1e08",
                border: `1px solid ${active ? "#1a5c1a88" : "#4a2e0e44"}`,
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: active ? "#6daa45" : "#4a2e0e",
                position: "absolute", top: 2, transition: "left 0.2s",
                left: active ? 19 : 2,
                boxShadow: active ? "0 0 6px rgba(109,170,69,0.6)" : "none",
              }} />
            </button>
          ) : (
            <div style={{
              fontSize: 9, fontWeight: 700, fontFamily: "serif",
              color: active ? "#6daa45" : "#4a2e0e",
              padding: "1px 6px", borderRadius: 4,
              border: `1px solid ${active ? "#6daa4544" : "#4a2e0e33"}`,
              background: active ? "#1a5c1a12" : "transparent",
            }}>
              {active ? "On" : "Off"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Select-style option list
  const currentOption = options?.find(o => o.value === current);
  return (
    <div style={{ borderBottom: "1px solid rgba(196,162,101,0.12)" }}>
      <button
        onClick={() => isHost && setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 0", background: "none", border: "none",
          cursor: isHost ? "pointer" : "default",
        }}
      >
        <span style={{ fontSize: 9, color: "#8a6830", fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#c4a265", fontFamily: "serif", textTransform: "capitalize" }}>
            {currentOption?.label || String(current)}
          </span>
          {isHost && (
            expanded
              ? <ChevronUp size={9} color="#4a2e0e" />
              : <ChevronDown size={9} color="#4a2e0e" />
          )}
        </div>
      </button>

      {isHost && expanded && options && (
        <div style={{ paddingBottom: 6 }}>
          {/* Level indicator */}
          <div style={{
            fontSize: 7.5, color: w.color, fontFamily: "serif",
            padding: "3px 6px", marginBottom: 4,
            background: w.bg, border: `1px solid ${w.border}`,
            borderRadius: 4,
          }}>
            {w.icon} {level === "safe" ? "Safe to change" : level === "moderate" ? "Moderate change" : "Dramatic — will alter the campaign"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {options.map(opt => {
              const isCurrent = opt.value === current;
              return (
                <button key={opt.value}
                  onClick={() => { if (!isCurrent) { onRequest(settingKey, opt.value, currentOption?.label || "", opt.label); setExpanded(false); } }}
                  style={{
                    width: "100%", textAlign: "left", padding: "5px 8px",
                    borderRadius: 5, cursor: isCurrent ? "default" : "pointer",
                    background: isCurrent ? `${w.color}18` : "transparent",
                    border: `1px solid ${isCurrent ? w.border : "rgba(196,162,101,0.15)"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isCurrent ? w.color : "#4a2e0e44", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: isCurrent ? w.color : "#c4a87a", fontFamily: "serif" }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 8, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic" }}>
                        {opt.description}
                      </div>
                    </div>
                    {isCurrent && <Check size={8} color={w.color} style={{ marginLeft: "auto" }} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
interface Props {
  campaign: Campaign;
  viewerAuthority: "owner" | "player" | "none";
  campaignId: number;
}

interface PendingChange {
  key: string;
  value: string | boolean;
  label: string;
  oldLabel: string;
  newLabel: string;
  level: WarnLevel;
}

export default function CampaignSettingsPanel({ campaign, viewerAuthority, campaignId }: Props) {
  const isHost = viewerAuthority === "owner";
  const [pending, setPending] = useState<PendingChange | null>(null);
  const { toast } = useToast();

  const patchMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${campaignId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
    onError: (err: Error) => {
      // apiRequest throws `Error("${status}: ${message}")` on a non-ok
      // response — a 409 here means the host locked settings after this
      // panel loaded (or a stale confirm-modal was still open). Without
      // this, the PATCH just silently no-ops from the player's POV.
      const locked = err.message.startsWith("409");
      toast({
        title: locked ? "Settings are locked" : "Couldn't change setting",
        description: locked
          ? "This campaign's settings are locked. Unlock them below before making changes."
          : err.message,
        variant: "destructive",
      });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${campaignId}/settings/lock`, { locked });
      return res.json();
    },
    onSuccess: (_data, locked) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      toast({ title: locked ? "Settings locked" : "Settings unlocked" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't change lock state", description: err.message, variant: "destructive" });
    },
  });

  const handleRequest = (key: string, newVal: string | boolean, oldLabel: string, newLabel: string) => {
    const level = warnLevel(key);
    setPending({ key, value: newVal, label: key, oldLabel, newLabel, level });
  };

  const handleConfirm = () => {
    if (!pending) return;
    patchMutation.mutate({ [pending.key]: pending.value });
    setPending(null);
  };

  const c = campaign as any;
  const locked = Boolean(campaign.settingsLocked);

  return (
    <>
      {pending && (
        <ConfirmModal
          settingLabel={pending.key.replace(/([A-Z])/g, ' $1').trim()}
          oldValue={pending.oldLabel}
          newValue={pending.newLabel}
          level={pending.level}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}

      <div>
        {!isHost && (
          <div style={{ fontSize: 7, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic", marginBottom: 6 }}>
            view only{locked ? " — settings are locked" : ""}
          </div>
        )}

        {isHost && (
          <div style={{
            fontSize: 8, color: "#b8880a", fontFamily: "serif",
            padding: "5px 8px", marginBottom: 8,
            background: "#b8880a0e", border: "1px solid #b8880a33",
            borderRadius: 5, lineHeight: 1.5,
          }}>
            <AlertTriangle size={8} style={{ display: "inline", marginRight: 4 }} />
            Changes take effect on the next DM response. Dramatic changes can feel jarring mid-scene.
          </div>
        )}

        {isHost && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "6px 8px", marginBottom: 8,
            background: locked ? "#8b1a1a12" : "rgba(255,255,255,0.03)",
            border: `1px solid ${locked ? "#8b1a1a44" : "rgba(196,162,101,0.2)"}`,
            borderRadius: 5,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {locked ? <Lock size={10} color="#c46060" /> : <Unlock size={10} color="#6daa45" />}
              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "serif", color: locked ? "#c46060" : "#8a6830" }}>
                {locked ? "Settings locked" : "Settings unlocked"}
              </span>
            </div>
            <button
              onClick={() => lockMutation.mutate(!locked)}
              disabled={lockMutation.isPending}
              style={{
                fontSize: 9, fontWeight: 700, fontFamily: "serif",
                color: locked ? "#6daa45" : "#c46060",
                background: locked ? "#1a5c1a12" : "#8b1a1a12",
                border: `1px solid ${locked ? "#6daa4544" : "#c4606044"}`,
                borderRadius: 4, padding: "3px 10px",
                cursor: lockMutation.isPending ? "default" : "pointer",
                opacity: lockMutation.isPending ? 0.6 : 1,
              }}
            >
              {lockMutation.isPending ? "…" : locked ? "Unlock" : "Lock"}
            </button>
          </div>
        )}

        {/* ── Toggles (safe) ── */}
        <SettingRow label="Story Mode" settingKey="storyMode"
          current={c.storyMode || false} isToggle isHost={isHost}
          toggleDescription="Characters can't permanently die, failures become complications"
          onRequest={handleRequest}
        />
        <SettingRow label="Epic Mode" settingKey="epicMode"
          current={c.epicMode || false} isToggle isHost={isHost}
          toggleDescription="Epic-tier power, level cap removed, reality-scale threats"
          onRequest={handleRequest}
        />

        <div style={{ height: 6 }} />

        {/* ── Select settings ── */}
        <SettingRow label="Tone" settingKey="tone"
          current={c.tone} options={TONE_OPTIONS} isHost={isHost}
          onRequest={handleRequest}
        />
        <SettingRow label="Combat" settingKey="combatStyle"
          current={c.combatStyle || "cinematic"} options={COMBAT_OPTIONS} isHost={isHost}
          onRequest={handleRequest}
        />
        <SettingRow label="Rules Weight" settingKey="rulesWeight"
          current={c.rulesWeight} options={RULES_OPTIONS} isHost={isHost}
          onRequest={handleRequest}
        />
        <SettingRow label="Power Level" settingKey="powerLevel"
          current={c.powerLevel} options={POWER_OPTIONS} isHost={isHost}
          onRequest={handleRequest}
        />

        {/* ── Warning colour key ── */}
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["safe", "moderate", "dramatic"] as WarnLevel[]).map(lvl => (
            <div key={lvl} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: WARN_TEXT[lvl].color }} />
              <span style={{ fontSize: 7, color: "#4a2e0e", fontFamily: "serif", textTransform: "capitalize" }}>{lvl}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
