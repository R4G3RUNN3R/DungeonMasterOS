/**
 * CampaignSuggestions — pending settings-change suggestions.
 *
 * Owner: sees every pending suggestion (from all participants) with
 * Accept/Decline controls.
 * Player: sees only their own pending suggestions (server already scopes
 * the GET response) as read-only cards, plus an inline form to submit a
 * new suggestion.
 * Viewers with no stake in the campaign ("none") see nothing — the server
 * rejects both the GET and POST for them with 403, so this component
 * doesn't even fetch in that case.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TONE_OPTIONS, COMBAT_OPTIONS, RULES_OPTIONS, POWER_OPTIONS } from "@/components/CampaignSettingsPanel";

interface Suggestion {
  id: number;
  campaignId: number;
  settingKey: string;
  currentValue: string;
  proposedValue: string;
  submittedByUserId: number;
  reason: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  ownerResponse: string | null;
  resolvedByUserId: number | null;
  resolvedAt: string | null;
  createdAt: string;
}

const SUGGESTABLE_KEYS = ["tone", "combatStyle", "rulesWeight", "powerLevel", "storyMode", "epicMode"] as const;

const KEY_LABELS: Record<(typeof SUGGESTABLE_KEYS)[number], string> = {
  tone: "Tone",
  combatStyle: "Combat Style",
  rulesWeight: "Rules Weight",
  powerLevel: "Power Level",
  storyMode: "Story Mode",
  epicMode: "Epic Mode",
};

// The two boolean-typed settings vs. the four enum-typed ones — matches
// BOOLEAN_CAMPAIGN_SETTING_KEYS in server/routes.ts. Drives which picker
// (toggle vs. select) the "suggest a change" form renders for the currently
// chosen settingKey.
const BOOLEAN_SUGGESTABLE_KEYS = new Set<(typeof SUGGESTABLE_KEYS)[number]>(["storyMode", "epicMode"]);

// Reuses CampaignSettingsPanel.tsx's exact option lists (value/label pairs)
// for the four enum-typed settings, so this picker can never drift out of
// sync with what an owner actually sees when changing the setting directly.
const ENUM_OPTIONS_BY_KEY: Partial<Record<(typeof SUGGESTABLE_KEYS)[number], { value: string; label: string }[]>> = {
  tone: TONE_OPTIONS,
  combatStyle: COMBAT_OPTIONS,
  rulesWeight: RULES_OPTIONS,
  powerLevel: POWER_OPTIONS,
};

interface Props {
  campaignId: number;
  viewerAuthority: "owner" | "player" | "none";
}

export default function CampaignSuggestions({ campaignId, viewerAuthority }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isHost = viewerAuthority === "owner";
  const canSuggest = viewerAuthority === "player";
  const canView = viewerAuthority !== "none";

  const { data: suggestions = [], isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/campaigns", campaignId, "settings", "suggestions"],
    queryFn: async () =>
      (await apiRequest("GET", `/api/campaigns/${campaignId}/settings/suggestions`)).json(),
    enabled: canView,
  });

  const [settingKey, setSettingKey] = useState<(typeof SUGGESTABLE_KEYS)[number]>("tone");
  // Either a boolean (for storyMode/epicMode) or an enum's string value (for
  // the other four keys) — never free text. See the picker markup below.
  const [proposedValue, setProposedValue] = useState<string | boolean>(TONE_OPTIONS[0]?.value ?? "");
  const [reason, setReason] = useState("");

  // Reset proposedValue to a sensible default of the *new* key's type
  // whenever settingKey changes, so a leftover boolean never leaks into an
  // enum field (or a leftover enum string into a boolean field).
  useEffect(() => {
    if (BOOLEAN_SUGGESTABLE_KEYS.has(settingKey)) {
      setProposedValue(false);
    } else {
      setProposedValue(ENUM_OPTIONS_BY_KEY[settingKey]?.[0]?.value ?? "");
    }
  }, [settingKey]);

  const proposedValueValid = BOOLEAN_SUGGESTABLE_KEYS.has(settingKey)
    ? typeof proposedValue === "boolean"
    : typeof proposedValue === "string" && proposedValue.trim().length > 0;

  const submitMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", `/api/campaigns/${campaignId}/settings/suggestions`, {
          settingKey,
          proposedValue,
          reason: reason.trim() || undefined,
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "settings", "suggestions"] });
      setReason("");
      toast({ title: "Suggestion sent", description: "The host will review your suggested change." });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't submit suggestion", description: err.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      (
        await apiRequest("PATCH", `/api/campaigns/${campaignId}/settings/suggestions/${id}`, { action })
      ).json(),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "settings", "suggestions"] });
      qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "settings", "history"] });
      // Accepting a suggestion actually changes the campaign's live setting
      // value, so anything reading the campaign itself needs a refetch too.
      qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      if (variables.action === "accept") {
        toast({ title: "Suggestion accepted", description: "The campaign setting has been updated." });
      } else {
        toast({ title: "Suggestion declined" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't resolve suggestion", description: err.message, variant: "destructive" });
    },
  });

  if (!canView) {
    return (
      <p style={{ fontSize: 9, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic" }}>
        Not available.
      </p>
    );
  }

  const pending = suggestions.filter((s) => s.status === "pending");

  return (
    <div>
      {isLoading && (
        <p style={{ fontSize: 9, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic" }}>Loading…</p>
      )}

      {!isLoading && pending.length === 0 && (
        <p style={{ fontSize: 9, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic" }}>
          No pending suggestions.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pending.map((s) => {
          const label = KEY_LABELS[s.settingKey as (typeof SUGGESTABLE_KEYS)[number]] ?? s.settingKey;
          const resolving = resolveMutation.isPending && resolveMutation.variables?.id === s.id;
          return (
            <div
              key={s.id}
              style={{
                border: "1px solid rgba(196,162,101,0.2)",
                borderRadius: 6,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: "#c4a87a", fontFamily: "serif" }}>
                {label}: <span style={{ color: "#8a6830", textDecoration: "line-through" }}>{s.currentValue}</span>{" "}
                → <span style={{ color: "#c4a265" }}>{s.proposedValue}</span>
              </div>
              {s.reason && (
                <div style={{ fontSize: 8.5, color: "#8a6830", fontFamily: "serif", fontStyle: "italic", marginTop: 3 }}>
                  "{s.reason}"
                </div>
              )}
              {isHost && (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    onClick={() => resolveMutation.mutate({ id: s.id, action: "accept" })}
                    disabled={resolving}
                    style={{
                      fontSize: 9, fontWeight: 700, fontFamily: "serif",
                      color: "#6daa45", background: "#1a5c1a12", border: "1px solid #6daa4544",
                      borderRadius: 4, padding: "3px 10px", cursor: resolving ? "default" : "pointer",
                      opacity: resolving ? 0.6 : 1,
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => resolveMutation.mutate({ id: s.id, action: "decline" })}
                    disabled={resolving}
                    style={{
                      fontSize: 9, fontWeight: 700, fontFamily: "serif",
                      color: "#c46060", background: "#8b1a1a12", border: "1px solid #c4606044",
                      borderRadius: 4, padding: "3px 10px", cursor: resolving ? "default" : "pointer",
                      opacity: resolving ? 0.6 : 1,
                    }}
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canSuggest && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(196,162,101,0.15)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#c4a87a", fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Suggest a change
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select
              value={settingKey}
              onChange={(e) => setSettingKey(e.target.value as (typeof SUGGESTABLE_KEYS)[number])}
              style={{
                fontSize: 9.5, fontFamily: "serif", color: "#c4a265",
                background: "#1a1108", border: "1px solid rgba(196,162,101,0.3)",
                borderRadius: 4, padding: "5px 6px",
              }}
            >
              {SUGGESTABLE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {KEY_LABELS[k]}
                </option>
              ))}
            </select>
            {BOOLEAN_SUGGESTABLE_KEYS.has(settingKey) ? (
              <select
                value={proposedValue ? "true" : "false"}
                onChange={(e) => setProposedValue(e.target.value === "true")}
                style={{
                  fontSize: 9.5, fontFamily: "serif", color: "#c4a265",
                  background: "#1a1108", border: "1px solid rgba(196,162,101,0.3)",
                  borderRadius: 4, padding: "5px 6px",
                }}
              >
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            ) : (
              <select
                value={typeof proposedValue === "string" ? proposedValue : ""}
                onChange={(e) => setProposedValue(e.target.value)}
                style={{
                  fontSize: 9.5, fontFamily: "serif", color: "#c4a265",
                  background: "#1a1108", border: "1px solid rgba(196,162,101,0.3)",
                  borderRadius: 4, padding: "5px 6px",
                }}
              >
                {(ENUM_OPTIONS_BY_KEY[settingKey] ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              style={{
                fontSize: 9.5, fontFamily: "serif", color: "#c4a265",
                background: "#1a1108", border: "1px solid rgba(196,162,101,0.3)",
                borderRadius: 4, padding: "5px 6px", resize: "vertical",
              }}
            />
            <button
              onClick={() => submitMutation.mutate()}
              disabled={!proposedValueValid || submitMutation.isPending}
              style={{
                fontSize: 10, fontWeight: 800, fontFamily: "serif", letterSpacing: "0.04em",
                color: "#c4a265", background: "linear-gradient(135deg, #c4a26533, #c4a26522)",
                border: "1px solid #c4a26588", borderRadius: 6, padding: "7px",
                cursor: !proposedValueValid || submitMutation.isPending ? "default" : "pointer",
                opacity: !proposedValueValid || submitMutation.isPending ? 0.6 : 1,
              }}
            >
              {submitMutation.isPending ? "Sending…" : "Suggest Change"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
