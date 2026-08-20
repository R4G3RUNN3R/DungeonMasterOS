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
//
// The dnd35e body is an original "paper form" recreation — our own layout
// and CSS evoking a classic tabletop character sheet (ability-score boxes,
// ruled saves/skills tables), not a trace of any publisher's copyrighted
// sheet. Every field still only shows real, authoritative data; a field
// with no backing value renders "—" rather than being fabricated to fill
// the sheet's shape.

import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ScrollText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRace } from "@shared/races";
import { getRulesAdapter } from "@/lib/rulesAdapters";
import type { FullCharacterSheet, SaveEntry } from "@/lib/characterSheetTypes";

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

type Item = {
  id: number;
  name: string;
  itemType: string;
  weight: number;
  carried: boolean;
  equipped: boolean;
  weaponDamageDice: string | null;
};

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

function fmt(n: number | null): string {
  if (n === null) return "—";
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
  const weapons = (itemsQuery.data ?? []).filter((i) => i.itemType === "weapon" && i.equipped);

  const loading = characterQuery.isLoading || sheetQuery.isLoading;
  const notFound = characterQuery.isError || sheetQuery.isError;
  const isDnd35e = sheet?.ruleset === "dnd35e";

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
                "popup=yes,width=900,height=950,resizable=yes,scrollbars=yes",
              );
            }}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" />
            Open in window
          </Button>
        </div>
      </header>

      {loading && <div className="max-w-3xl mx-auto px-4 py-6 text-sm text-muted-foreground">Loading character sheet…</div>}
      {notFound && !loading && (
        <div className="max-w-3xl mx-auto px-4 py-6 text-sm text-muted-foreground">Could not load this character sheet.</div>
      )}

      {character && sheet && hud && (
        isDnd35e ? (
          <Dnd35eSheet character={character} sheet={sheet} hud={hud} raceDef={raceDef} titles={titles} featSections={featSections} weapons={weapons} />
        ) : (
          <GenericSheet character={character} sheet={sheet} hud={hud} raceDef={raceDef} titles={titles} featSections={featSections} weapons={weapons} />
        )
      )}
    </div>
  );
}

type SheetBodyProps = {
  character: Character;
  sheet: FullCharacterSheet;
  hud: ReturnType<ReturnType<typeof getRulesAdapter>["buildCharacterHud"]>;
  raceDef: ReturnType<typeof getRace>;
  titles?: Array<{ title: string; establishedAt: string | null }>;
  featSections: ParsedSection[];
  weapons: Item[];
};

function xpDisplay(xp: FullCharacterSheet["xp"]): string {
  return xp.nextLevel === null ? `${xp.current} (max level)` : `${xp.current}/${xp.nextLevel}`;
}

function attackBreakdownLabel(b: FullCharacterSheet["attack"]["breakdown"]): string {
  const parts: string[] = [`ability ${fmt(b.ability)}`, `base attack ${fmt(b.baseAttack)}`];
  if (b.effect !== 0) parts.push(`effects ${fmt(b.effect)}`);
  if (b.size !== 0) parts.push(`size ${fmt(b.size)}`);
  if (b.cinematic !== 0) parts.push(`cinematic ${fmt(b.cinematic)}`);
  return parts.join(", ");
}

const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"] as const;

function abilityBoxLabel(key: string): string {
  return key.toUpperCase();
}

function saveAbilityHint(save: SaveEntry): string {
  // The 3.5e save keys are fixed to their governing ability by definition
  // (server/character-stats.ts's DND35E_SAVES) — shown here only as a
  // parenthetical hint, matching the classic sheet's "(Con)"-style notation.
  if (save.key === "fortitude") return "Con";
  if (save.key === "reflex") return "Dex";
  if (save.key === "will") return "Wis";
  return "";
}

function Dnd35eSheet({ character, sheet, hud, raceDef, titles, featSections, weapons }: SheetBodyProps) {
  const sortedSkills = sheet.skills.slice().sort((a, b) => a.name.localeCompare(b.name));
  const half = Math.ceil(sortedSkills.length / 2);
  const skillColumns = [sortedSkills.slice(0, half), sortedSkills.slice(half)];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="parchment-surface parchment-ruled rounded-md shadow-lg overflow-hidden">
        {/* Header strip */}
        <div className="px-6 py-5 border-b-2 border-[#654a27]/40 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="parchment-heading text-3xl font-bold leading-tight">{character.name}</div>
            <div className="parchment-label text-xs mt-1">
              {character.race} · {character.charClass} · Level {character.level}
            </div>
            {titles && titles.length > 0 && (
              <div className="text-xs italic mt-1 opacity-80">Known as {titles.map((t) => t.title).join(", ")}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="parchment-label text-[10px]">Experience</div>
            <div className="parchment-badge !rounded-md !h-auto !min-w-[64px] px-2 py-1 text-sm tabular-nums">
              {xpDisplay(sheet.xp)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-5 p-6">
          {/* Left rail: ability score boxes */}
          <div className="flex md:flex-col gap-3 flex-wrap">
            {ABILITY_ORDER.map((key) => (
              <div key={key} className="relative flex-1 min-w-[92px] md:min-w-0">
                <div className="border-2 border-[#654a27]/50 rounded-md bg-[#f6ecd2]/70 pt-2 pb-5 text-center">
                  <div className="parchment-label text-[10px]">{abilityBoxLabel(key)}</div>
                  <div className="parchment-heading text-3xl font-bold leading-none mt-1">{sheet.abilities[key].score}</div>
                </div>
                <div className="parchment-badge absolute left-1/2 -translate-x-1/2 -bottom-3">
                  {fmt(sheet.abilities[key].modifier)}
                </div>
              </div>
            ))}
          </div>

          {/* Right column: combat strip, saves, attack, skills */}
          <div className="space-y-5 mt-2 md:mt-0">
            {/* Combat strip */}
            <div className="grid grid-cols-4 gap-3">
              <StatBox label="Hit Points" value={hud.hp ? `${hud.hp.current}/${hud.hp.max}` : "—"} />
              <StatBox label="Armor Class" value={hud.ac !== null ? String(hud.ac) : "—"} />
              <StatBox label="Initiative" value={fmt(hud.initiative)} />
              <StatBox label="Speed" value={hud.speed !== null ? `${hud.speed} ft` : "—"} />
            </div>

            {/* Saving Throws */}
            <div>
              <SectionLabel>Saving Throws</SectionLabel>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {sheet.saves.map((save) => (
                    <tr key={save.key} className="border-b border-[#654a27]/25 last:border-b-0">
                      <td className="py-1.5 parchment-label text-xs">{save.label}</td>
                      <td className="py-1.5 text-xs opacity-70">({saveAbilityHint(save)})</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{fmt(save.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Attack */}
            <div>
              <SectionLabel>Base Attack</SectionLabel>
              <div className="text-sm tabular-nums">
                {fmt(sheet.attack.total)}
                {sheet.attack.extraAttackBonuses.length > 0 && (
                  <>
                    {" / "}
                    {sheet.attack.extraAttackBonuses.map((b) => fmt(b)).join(" / ")}
                    <span className="text-xs opacity-70"> (full attack)</span>
                  </>
                )}
                {" "}
                <span className="text-xs opacity-70">· {character.attacksPerRound} attack{character.attacksPerRound === 1 ? "" : "s"}/round</span>
              </div>
              <div className="text-[11px] opacity-60 mt-0.5">{attackBreakdownLabel(sheet.attack.breakdown)}</div>
            </div>

            {/* Weapons — equipped weapons only, so this stays empty rather
                than listing every carried item; damage dice only shown when
                actually recorded on the item. */}
            <div>
              <SectionLabel>Weapons</SectionLabel>
              {weapons.length === 0 ? (
                <div className="text-xs opacity-60">No weapon equipped.</div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-[10px] parchment-label opacity-70">
                      <th className="text-left font-normal pb-1">Weapon</th>
                      <th className="text-right font-normal pb-1">Attack</th>
                      <th className="text-right font-normal pb-1">Damage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weapons.map((w) => (
                      <tr key={w.id} className="border-b border-[#654a27]/25 last:border-b-0">
                        <td className="py-1.5">{w.name}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(sheet.attack.total)}</td>
                        <td className="py-1.5 text-right tabular-nums">{w.weaponDamageDice || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Skills — ruled two-column table */}
        <div className="px-6 pb-6">
          <SectionLabel>Skills</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {skillColumns.map((col, colIdx) => (
              <table key={colIdx} className="w-full text-sm border-collapse">
                <tbody>
                  {col.map((skill) => (
                    <tr key={skill.name} className="border-b border-[#654a27]/15">
                      <td className="py-1 w-4">
                        {skill.proficient && <span className="inline-block w-2 h-2 rounded-sm bg-[#654a27]" aria-label="Trained" />}
                      </td>
                      <td className="py-1">{skill.name}</td>
                      <td className="py-1 text-xs opacity-60 w-10">({skill.ability.toUpperCase()})</td>
                      <td className="py-1 text-right font-medium tabular-nums w-10">{fmt(skill.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </div>

        {/* Racial traits + Feats */}
        {(raceDef || featSections.length > 0) && (
          <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {raceDef && (
              <div className="border border-[#654a27]/30 rounded-md p-3">
                <SectionLabel>Racial Traits — {raceDef.displayName}</SectionLabel>
                <div className="text-xs opacity-70 mb-2">
                  {raceDef.size === "small" ? "Small" : "Medium"} · {raceDef.speed} ft
                  {raceDef.vision.length > 0 ? ` · ${raceDef.vision.join(", ")}` : ""}
                </div>
                <div className="space-y-1.5">
                  {raceDef.traits.map((trait) => (
                    <div key={trait.name} className="text-sm">
                      <span className="font-semibold">{trait.name}.</span> <span className="opacity-80">{trait.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {featSections.length > 0 && (
              <div className="border border-[#654a27]/30 rounded-md p-3">
                <SectionLabel>Feats &amp; Features</SectionLabel>
                <div className="space-y-1.5">
                  {featSections.flatMap((section) => section.entries ?? []).map((entry, idx) => (
                    <div key={`${entry.key || entry.name || "entry"}-${idx}`} className="text-sm">
                      <span className="font-semibold">{entry.name || entry.key}.</span>{" "}
                      <span className="opacity-80">{entry.description || entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#654a27]/40 rounded-md bg-[#f6ecd2]/70 py-2 text-center">
      <div className="parchment-label text-[9px]">{label}</div>
      <div className="parchment-heading text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="parchment-label text-xs border-b border-[#654a27]/40 pb-1 mb-2">{children}</div>;
}

// Fallback for any ruleset that isn't 3.5e yet — plain card layout until
// that ruleset gets its own recreation (5e is next, per product decision).
function GenericSheet({ character, sheet, hud, raceDef, titles, featSections }: SheetBodyProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
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

      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">HP</div>
            <div className="text-sm font-semibold">{hud.hp ? `${hud.hp.current}/${hud.hp.max}` : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">AC</div>
            <div className="text-sm font-semibold">{hud.ac ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Init</div>
            <div className="text-sm font-semibold">{fmt(hud.initiative)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Speed</div>
            <div className="text-sm font-semibold">{hud.speed !== null ? `${hud.speed} ft` : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">XP</div>
            <div className="text-sm font-semibold">{xpDisplay(sheet.xp)}</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 font-medium">Ability Scores</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {ABILITY_ORDER.map((key) => (
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
          <div className="font-medium">Racial Traits — {raceDef.displayName}</div>
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
          <ScrollText className="w-4 h-4" />
          Attack
        </div>
        <div className="text-sm text-muted-foreground">
          Attack bonus: <span className="font-semibold text-foreground">{fmt(sheet.attack.total)}</span>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="font-medium">Saving Throws</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {sheet.saves.map((save) => (
            <div key={save.key} className={`rounded-lg border p-2 text-center ${save.proficient ? "border-primary/40 bg-primary/5" : "border-border"}`}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{save.label}</div>
              <div className="text-sm font-semibold">{fmt(save.total)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-medium">Skills</div>
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
            <Sparkles className="w-4 h-4" />
            Feats &amp; Features
          </div>
          {featSections.map((section, sIdx) => (
            <div key={`${section.label}-${sIdx}`} className="space-y-2">
              {section.entries?.map((entry, eIdx) => (
                <div key={`${entry.key || entry.name || "entry"}-${eIdx}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="font-medium">{entry.name || entry.key || "Entry"}</div>
                  {(entry.description || entry.value) && (
                    <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{entry.description || entry.value}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
