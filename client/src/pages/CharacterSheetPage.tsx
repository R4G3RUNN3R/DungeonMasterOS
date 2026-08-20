// client/src/pages/CharacterSheetPage.tsx
//
// The one canonical, ruleset-aware full Character Sheet (design decision
// "Full Character Sheet – Responsive Hybrid", locked 2026-08-18). Reachable
// at /#/character-sheet/:characterId — a real route, not a Dialog, so it
// works as a fullscreen destination on every device and can be opened in a
// separate window on desktop. Reuses the same rules-adapter HUD model for
// vitals (so it can never disagree with the left HUD) plus the server's
// authoritative FullCharacterSheet for ability scores, skills, saves,
// attack, racial traits, and established titles.

import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Heart, Shield, ScrollText, Sword, Sparkles, Zap, Wind } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRace } from "@shared/races";
import { getRulesAdapter } from "@/lib/rulesAdapters";
import type { FullCharacterSheet } from "@/lib/characterSheetTypes";

type Character = {
  id: number;
  campaignId: number;
  name: string;
  race: string;
  charClass: string;
  level: number;
  hp: number;
  maxHp: number;
  speed: number;
  attacksPerRound: number;
  ac: number;
  xp: number;
  characterData: string;
};

type Item = { id: number; weight: number; carried: boolean; equipped: boolean };

type ParsedSection = {
  label: string;
  entries?: Array<{ key?: string; name?: string; value?: string; description?: string }>;
};

function safeParseFeats(raw: string): ParsedSection[] {
  try {
    const parsed = JSON.parse(raw || "{}");
    const sections: ParsedSection[] = Array.isArray(parsed.sections) ? parsed.sections : [];
    return sections.filter((s) => {
      const label = String(s.label || "").toLowerCase();
      return label.includes("feat") || label.includes("abilit") || label.includes("feature") || label.includes("trait");
    });
  } catch {
    return [];
  }
}

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

const RULESET_NAMES: Record<string, string> = {
  dnd5e: "D&D 5th Edition",
  dnd35e: "D&D 3.5",
};

export default function CharacterSheetPage() {
  const [, params] = useRoute("/character-sheet/:characterId");
  const [, navigate] = useLocation();
  const characterId = Number(params?.characterId);

  const characterQuery = useQuery<Character>({
    queryKey: [`/api/characters/${characterId}`],
    enabled: Number.isFinite(characterId),
  });
  const itemsQuery = useQuery<Item[]>({
    queryKey: [`/api/characters/${characterId}/items`],
    enabled: Number.isFinite(characterId),
  });
  const sheetQuery = useQuery<FullCharacterSheet>({
    queryKey: [`/api/characters/${characterId}/sheet`],
    enabled: Number.isFinite(characterId),
  });
  const titlesQuery = useQuery<Array<{ title: string; establishedAt: string | null }>>({
    queryKey: [`/api/characters/${characterId}/titles`],
    enabled: Number.isFinite(characterId),
  });

  const character = characterQuery.data;
  const sheet = sheetQuery.data;
  const featSections = character ? safeParseFeats(character.characterData) : [];
  const raceDef = sheet && character ? getRace(sheet.ruleset, character.race) : undefined;
  const titles = titlesQuery.data;

  // Same HUD model the left panel uses — vitals here can never disagree
  // with what the player sees during play.
  const hud =
    character && itemsQuery.data
      ? getRulesAdapter().buildCharacterHud(character, itemsQuery.data, sheet?.saves)
      : null;

  const loading = characterQuery.isLoading || sheetQuery.isLoading;
  const notFound = characterQuery.isError || sheetQuery.isError;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {sheet && (
            <Badge variant="outline" className="text-xs">
              {RULESET_NAMES[sheet.ruleset] || sheet.ruleset}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(
                window.location.href,
                `dmos-character-sheet-${characterId}`,
                "popup=yes,width=900,height=900,resizable=yes,scrollbars=yes",
              );
            }}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" />
            Open in window
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {loading && <div className="text-sm text-muted-foreground">Loading character sheet…</div>}
        {notFound && !loading && (
          <div className="text-sm text-muted-foreground">Could not load this character sheet.</div>
        )}

        {character && sheet && (
          <>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-2xl font-semibold leading-tight">{character.name}</div>
                <div className="text-sm text-muted-foreground">
                  {character.race} • {character.charClass} • Level {character.level}
                </div>
                {titles && titles.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Known as: <span className="text-foreground italic">{titles.map((t) => t.title).join(", ")}</span>
                  </div>
                )}
              </div>
            </div>

            {hud && (
              <Card className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                      <Heart className="w-3 h-3" /> HP
                    </div>
                    <div className="text-sm font-semibold">{hud.hp ? `${hud.hp.current}/${hud.hp.max}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" /> AC
                    </div>
                    <div className="text-sm font-semibold">{hud.ac ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" /> Init
                    </div>
                    <div className="text-sm font-semibold">{hud.initiative !== null ? fmt(hud.initiative) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                      <Wind className="w-3 h-3" /> Speed
                    </div>
                    <div className="text-sm font-semibold">{hud.speed !== null ? `${hud.speed} ft` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">XP</div>
                    <div className="text-sm font-semibold">{character.xp}</div>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="w-4 h-4 text-sky-500" />
                Ability Scores
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => (
                  <div key={key} className="rounded-lg border border-border p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{key.toUpperCase()}</div>
                    <div className="text-sm font-semibold">{sheet.abilities[key].score}</div>
                    <div className="text-xs text-muted-foreground">{fmt(sheet.abilities[key].modifier)}</div>
                  </div>
                ))}
              </div>
            </Card>

            {raceDef && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Racial Traits — {raceDef.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {raceDef.size === "small" ? "Small" : "Medium"} · {raceDef.speed} ft
                    {raceDef.vision.length > 0 ? ` · ${raceDef.vision.join(", ")}` : ""}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {raceDef.traits.map((trait) => (
                    <div key={trait.name} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="font-medium">{trait.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{trait.description}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium">
                <Sword className="w-4 h-4 text-orange-400" />
                Attack
              </div>
              <div className="text-sm text-muted-foreground">
                Attack bonus: <span className="font-semibold text-foreground">{fmt(sheet.attack.total)}</span>
                {sheet.attack.extraAttackBonuses.length > 0 && (
                  <span>
                    {" "}
                    / {sheet.attack.extraAttackBonuses.map((b) => fmt(b)).join(" / ")}
                    <span className="text-xs"> (full attack — 3.5e iterative)</span>
                  </span>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="w-4 h-4 text-sky-500" />
                Saving Throws
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {sheet.saves.map((save) => (
                  <div
                    key={save.key}
                    className={`rounded-lg border p-2 text-center ${save.proficient ? "border-primary/40 bg-primary/5" : "border-border"}`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{save.label}</div>
                    <div className="text-sm font-semibold">{fmt(save.total)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium">
                <ScrollText className="w-4 h-4 text-orange-400" />
                Skills
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {sheet.skills
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((skill) => (
                    <div key={skill.name} className="flex items-center justify-between text-sm rounded-md px-2 py-1 hover:bg-muted/50">
                      <span className="flex items-center gap-1.5">
                        {skill.proficient && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />}
                        {skill.name}
                        <span className="text-xs text-muted-foreground">({skill.ability.toUpperCase()})</span>
                      </span>
                      <span className="font-medium">{fmt(skill.total)}</span>
                    </div>
                  ))}
              </div>
            </Card>

            {featSections.length > 0 && (
              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2 font-medium">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Feats &amp; Features
                </div>
                {featSections.map((section, sIdx) => (
                  <div key={`${section.label}-${sIdx}`} className="space-y-2">
                    {(section.entries?.length ?? 0) > 0 && (
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{section.label}</div>
                    )}
                    {section.entries?.map((entry, eIdx) => (
                      <div key={`${entry.key || entry.name || "entry"}-${eIdx}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="font-medium">{entry.name || entry.key || "Entry"}</div>
                        {(entry.description || entry.value) && (
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {entry.description || entry.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
