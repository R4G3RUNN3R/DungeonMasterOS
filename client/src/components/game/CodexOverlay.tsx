// client/src/components/game/CodexOverlay.tsx
//
// The canonical personal character Codex (design spec §4.4/§12.2 — the one
// overlay the spec singles out for stronger page/book presentation). A
// two-page spread on wide screens (left page: Traits/Backstory; right page:
// Abilities, Deeds, Titles, Chronicle) with a spine gutter down the middle;
// single scrolling page on mobile.
//
// Deeds reuses the same authoritative achievement definitions/API as the
// old AchievementsPanel (never a second rules engine). Titles reuses the
// same established-titles-only endpoint CharacterSheetModal already proved
// correct — no candidates, no progress, no hint of the unlock mechanic.
// Chronicle/World Knowledge ports CodexModal's world-state summary. None of
// this exposes internal AI/debug information — only what a player already
// sees narrated or has otherwise learned.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles, Trophy, Globe2, Flag, CheckCircle2, AlertCircle, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACHIEVEMENTS, type AchievementCategory } from "@shared/achievements";

type ParsedSection = {
  label: string;
  type?: string;
  entries?: Array<{ key?: string; name?: string; value?: string; description?: string }>;
};

type UnlockedAchievement = { achievementId: string; unlockedAt: string };
type EstablishedTitle = { title: string; establishedAt: string | null };

type WorldMemory = {
  summary?: string;
  activeThreads?: string[];
  discoveredFacts?: string[];
  npcNotes?: string[];
  recentConsequences?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: number;
  traits: string;
  backstory: string;
  characterData: string;
  worldState?: string;
  onSubmitReport: (description: string) => Promise<void>;
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  character: "Character",
  combat: "Combat",
  social: "Social",
  exploration: "Exploration",
  meta: "Meta",
  secret: "Secret",
};
const CATEGORY_ORDER: AchievementCategory[] = ["character", "combat", "social", "exploration", "meta", "secret"];

function safeParseWorldState(raw?: string): { currentScene?: string; memory?: WorldMemory } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return { currentScene: parsed.currentScene, memory: parsed.memory };
  } catch {
    return {};
  }
}

function MemoryList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--dm-parchment-muted))]">{title}</div>
      <ul className="space-y-1">
        {items.map((entry, idx) => (
          <li key={idx} className="text-sm pl-3 border-l-2 border-[hsl(var(--dm-parchment-line))]">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}

function safeParseSections(raw: string): ParsedSection[] {
  try {
    const parsed = JSON.parse(raw || "{}");
    return Array.isArray(parsed.sections) ? parsed.sections : [];
  } catch {
    return [];
  }
}

function EntryList({ entries }: { entries?: ParsedSection["entries"] }) {
  if (!entries?.length) {
    return <p className="text-sm text-[hsl(var(--dm-parchment-muted))]">No entries.</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => (
        <div
          key={`${entry.key || entry.name || "entry"}-${idx}`}
          className="rounded-sm border border-[hsl(var(--dm-parchment-line))] px-3 py-2 text-sm"
        >
          <div className="font-medium">{entry.name || entry.key || "Entry"}</div>
          {(entry.description || entry.value) && (
            <div className="text-xs text-[hsl(var(--dm-parchment-muted))] mt-1 whitespace-pre-wrap">
              {entry.description || entry.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CodexOverlay({
  open,
  onOpenChange,
  characterId,
  traits,
  backstory,
  characterData,
  worldState,
  onSubmitReport,
}: Props) {
  const sections = useMemo(() => safeParseSections(characterData), [characterData]);
  const parsedWorldState = useMemo(() => safeParseWorldState(worldState), [worldState]);

  const grantedAbilities = useMemo(
    () =>
      sections.find(
        (s) => String(s.label || "").toLowerCase() === "granted abilities" || String(s.type || "").toLowerCase() === "abilities",
      ),
    [sections],
  );

  const otherSections = useMemo(
    () =>
      sections.filter((s) => {
        const label = String(s.label || "").toLowerCase();
        return label !== "granted abilities" && label !== "currency" && label !== "inventory" && label !== "items";
      }),
    [sections],
  );

  // Deeds: same authoritative achievement definitions/API the old
  // AchievementsPanel used — never a second rules engine.
  const { data: unlocked } = useQuery<UnlockedAchievement[]>({
    queryKey: ["/api/achievements"],
    enabled: open,
  });
  const unlockedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of unlocked ?? []) map.set(u.achievementId, u.unlockedAt);
    return map;
  }, [unlocked]);
  const achievementsByCategory = useMemo(() => {
    const groups = new Map<AchievementCategory, typeof ACHIEVEMENTS>();
    for (const a of ACHIEVEMENTS) {
      if (a.hidden && !unlockedMap.has(a.id)) continue; // hidden stays hidden until unlocked
      const list = groups.get(a.category) ?? [];
      list.push(a);
      groups.set(a.category, list);
    }
    return groups;
  }, [unlockedMap]);
  const totalUnlocked = unlockedMap.size;

  // Titles: established only — the same endpoint CharacterSheetModal already
  // proved correct. No candidates, no progress, no unlock-mechanic hints.
  const { data: titles } = useQuery<EstablishedTitle[]>({
    queryKey: [`/api/characters/${characterId}/titles`],
    enabled: open && Number.isFinite(characterId),
  });

  const [reportText, setReportText] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmitReport() {
    if (!reportText.trim()) return;
    setReportSubmitting(true);
    setReportStatus("idle");
    try {
      await onSubmitReport(reportText.trim());
      setReportStatus("success");
      setReportText("");
    } catch {
      setReportStatus("error");
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dm-shell dm-tome border-none max-w-3xl max-h-[85vh] overflow-hidden p-0 gap-0">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <BookOpen className="w-4 h-4" style={{ color: "hsl(var(--dm-bronze))" }} />
          <DialogTitle className="dm-heading text-lg font-semibold">Codex</DialogTitle>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 overflow-y-auto dm-scroll" style={{ maxHeight: "70vh" }}>
          {/* Spine gutter shadow, visible only on the two-page desktop spread */}
          <div className="hidden md:block absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 dm-tome-spine pointer-events-none" />

          {/* Left page */}
          <div className="px-6 pb-6 md:pr-8 space-y-5 md:border-r border-[hsl(var(--dm-parchment-line))]">
            <div className="space-y-2">
              <div className="dm-heading text-xs uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>
                Traits
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{traits?.trim() || "No traits entered."}</p>
            </div>

            <div className="space-y-2">
              <div className="dm-heading text-xs uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>
                Backstory
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{backstory?.trim() || "No backstory entered."}</p>
            </div>
          </div>

          {/* Right page */}
          <div className="px-6 pb-6 md:pl-8 pt-5 md:pt-0 space-y-5">
            <div className="space-y-2">
              <div className="dm-heading text-xs uppercase tracking-wide flex items-center gap-1" style={{ color: "hsl(var(--dm-bronze))" }}>
                <Sparkles className="w-3 h-3" />
                Abilities &amp; Features
              </div>
              {grantedAbilities?.entries?.length ? (
                <EntryList entries={grantedAbilities.entries} />
              ) : (
                <p className="text-sm text-[hsl(var(--dm-parchment-muted))]">No tracked granted abilities yet.</p>
              )}
            </div>

            {otherSections.map((section, sectionIndex) => (
              <div key={`${section.label}-${sectionIndex}`} className="space-y-2">
                <div className="dm-heading text-xs uppercase tracking-wide" style={{ color: "hsl(var(--dm-bronze))" }}>
                  {section.label || "Section"}
                </div>
                <EntryList entries={section.entries} />
              </div>
            ))}

            {titles && titles.length > 0 && (
              <div className="space-y-2">
                <div className="dm-heading text-xs uppercase tracking-wide flex items-center gap-1" style={{ color: "hsl(var(--dm-bronze))" }}>
                  <Crown className="w-3 h-3" />
                  Titles &amp; Epithets
                </div>
                <p className="text-sm italic">{titles.map((t) => t.title).join(", ")}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="dm-heading text-xs uppercase tracking-wide flex items-center justify-between gap-1" style={{ color: "hsl(var(--dm-bronze))" }}>
                <span className="flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  Deeds &amp; Achievements
                </span>
                <span className="text-[11px] normal-case tracking-normal text-[hsl(var(--dm-parchment-muted))]">
                  {totalUnlocked} / {ACHIEVEMENTS.length}
                </span>
              </div>
              <div className="space-y-3">
                {CATEGORY_ORDER.filter((cat) => achievementsByCategory.has(cat)).map((cat) => (
                  <div key={cat} className="space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--dm-parchment-muted))]">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {achievementsByCategory.get(cat)!.map((a) => {
                        const isUnlocked = unlockedMap.has(a.id);
                        return (
                          <div
                            key={a.id}
                            className={cn(
                              "rounded-sm border px-2.5 py-2 flex items-start gap-2 text-sm",
                              isUnlocked
                                ? "border-[hsl(var(--dm-bronze))]"
                                : "border-[hsl(var(--dm-parchment-line))] opacity-60",
                            )}
                          >
                            <span className="text-base leading-none mt-0.5">{a.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium flex items-center gap-1.5 flex-wrap">
                                {a.name}
                                {a.rewardTurns ? (
                                  <span className="text-[10px] dm-amber-text">+{a.rewardTurns} Turns</span>
                                ) : null}
                              </div>
                              <div className="text-xs text-[hsl(var(--dm-parchment-muted))] mt-0.5">{a.description}</div>
                              {isUnlocked && (
                                <div className="text-[10px] text-[hsl(var(--dm-parchment-muted))] mt-1">
                                  Unlocked {new Date(unlockedMap.get(a.id)!).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="dm-heading text-xs uppercase tracking-wide flex items-center gap-1" style={{ color: "hsl(var(--dm-bronze))" }}>
                <Globe2 className="w-3 h-3" />
                Chronicle &amp; World Knowledge
              </div>

              {parsedWorldState.currentScene && (
                <div className="text-sm rounded-sm border border-[hsl(var(--dm-parchment-line))] p-3 whitespace-pre-wrap">
                  {parsedWorldState.currentScene}
                </div>
              )}
              {parsedWorldState.memory?.summary && (
                <p className="text-sm leading-relaxed">{parsedWorldState.memory.summary}</p>
              )}
              {!parsedWorldState.currentScene && !parsedWorldState.memory?.summary && (
                <p className="text-sm text-[hsl(var(--dm-parchment-muted))]">
                  The story hasn't started yet — nothing recorded.
                </p>
              )}

              <div className="space-y-3">
                <MemoryList title="Active Threads" items={parsedWorldState.memory?.activeThreads} />
                <MemoryList title="Discovered Facts" items={parsedWorldState.memory?.discoveredFacts} />
                <MemoryList title="NPC Notes" items={parsedWorldState.memory?.npcNotes} />
                <MemoryList title="Recent Consequences" items={parsedWorldState.memory?.recentConsequences} />
              </div>
            </div>

            <div className="space-y-2 pb-2">
              <div className="dm-heading text-xs uppercase tracking-wide flex items-center gap-1" style={{ color: "hsl(var(--dm-bronze))" }}>
                <Flag className="w-3 h-3" />
                Something look wrong?
              </div>
              <p className="text-xs text-[hsl(var(--dm-parchment-muted))]">
                If the DM contradicted itself, teleported you somewhere with no explanation, or anything else
                above looks broken — paste the part that's wrong or just describe it in your own words. This
                goes straight to the team, along with the current world state for context.
              </p>
              <Textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="e.g. 'Reality shifted without warning' — I was in a stone chamber and suddenly I'm in a market with no transition."
                rows={3}
                className="text-sm"
              />
              {reportStatus === "success" && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sent — thanks for flagging it.
                </div>
              )}
              {reportStatus === "error" && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Couldn't send that just now. Try again in a moment.
                </div>
              )}
              <Button size="sm" disabled={!reportText.trim() || reportSubmitting} onClick={handleSubmitReport}>
                {reportSubmitting ? "Sending..." : "Report a Bug"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
