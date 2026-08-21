/**
 * CampaignSettingsHistory — read-only, reverse-chronological audit trail of
 * campaign setting changes (owner-direct edits and accepted suggestions
 * alike). Viewable by the owner and any player participant; the server
 * rejects the request for viewers with no stake in the campaign.
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface HistoryRow {
  id: number;
  campaignId: number;
  settingKey: string;
  oldValue: string | null;
  newValue: string;
  changedByUserId: number | null;
  source: "owner-direct" | "accepted-suggestion" | "system";
  suggestionId: number | null;
  note: string | null;
  createdAt: string;
}

const SOURCE_LABEL: Record<HistoryRow["source"], string> = {
  "owner-direct": "changed by host",
  "accepted-suggestion": "via accepted suggestion",
  system: "system change",
};

interface Props {
  campaignId: number;
}

export default function CampaignSettingsHistory({ campaignId }: Props) {
  const { data: rows = [], isLoading } = useQuery<HistoryRow[]>({
    queryKey: ["/api/campaigns", campaignId, "settings", "history"],
    queryFn: async () =>
      (await apiRequest("GET", `/api/campaigns/${campaignId}/settings/history`)).json(),
  });

  if (isLoading) {
    return (
      <p style={{ fontSize: 9, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic" }}>Loading…</p>
    );
  }

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 9, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic" }}>
        No changes yet.
      </p>
    );
  }

  // Newest first. createdAt is an ISO string set server-side at insert time.
  const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sorted.map((r) => (
        <div
          key={r.id}
          style={{ borderBottom: "1px solid rgba(196,162,101,0.12)", paddingBottom: 6 }}
        >
          <div style={{ fontSize: 9, fontFamily: "serif", color: "#c4a87a" }}>
            <span style={{ color: "#4a2e0e" }}>
              {new Date(r.createdAt).toLocaleDateString()}
            </span>{" "}
            — <strong style={{ color: "#c4a265" }}>{r.settingKey}</strong>:{" "}
            <span style={{ color: "#8a6830", textDecoration: "line-through" }}>{r.oldValue ?? "—"}</span> →{" "}
            <span style={{ color: "#c4a265" }}>{r.newValue}</span>
          </div>
          <div style={{ fontSize: 8, color: "#4a2e0e", fontFamily: "serif", fontStyle: "italic", marginTop: 1 }}>
            {SOURCE_LABEL[r.source] ?? r.source}
            {r.note ? ` — ${r.note}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
