import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Shield, Sword, Sparkles } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRace } from "@shared/races";

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface FullCharacterSheet {
  ruleset: string;
  abilities: Record<Ability, { score: number; modifier: number }>;
  skills: Array<{ name: string; ability: Ability; total: number; proficient: boolean }>;
  saves: Record<Ability, { total: number; proficient: boolean }>;
  attack: { total: number; extraAttackBonuses: number[] };
}

type ParsedSection = {
  label: string;
  entries?: Array<{ key?: string; name?: string; value?: string; description?: string }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: number;
  characterName: string;
  race: string;
  charClass: string;
  level: number;
  ac: number;
  characterData: string;
};

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

const RULESET_NAMES: Record<string, string> = {
  dnd5e: "D&D 5th Edition",
  dnd35e: "D&D 3.5",
};

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

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

export default function CharacterSheetModal({
  open, onOpenChange, characterId, characterName, race, charClass, level, ac, characterData,
}: Props) {
  const { data: sheet, isLoading } = useQuery<FullCharacterSheet>({
    queryKey: [`/api/characters/${characterId}/sheet`],
    enabled: open,
  });

  // Established titles only — no progress, no counts, no hint that this is
  // an unlockable system. If the world hasn't given this character a name
  // yet, this section simply doesn't appear.
  const { data: titles } = useQuery<Array<{ title: string; establishedAt: string | null }>>({
    queryKey: [`/api/characters/${characterId}/titles`],
    enabled: open,
  });

  const featSections = useMemo(() => safeParseFeats(characterData), [characterData]);
  const raceDef = sheet ? getRace(sheet.ruleset, race) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            Character Sheet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold leading-tight">{characterName}</div>
              <div className="text-sm text-muted-foreground">
                {race} • {charClass} • Level {level}
              </div>
              {titles && titles.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Known as: <span className="text-foreground italic">{titles.map((t) => t.title).join(", ")}</span>
                </div>
              )}
            </div>
            {sheet && (
              <Badge variant="outline" className="text-xs">
                {RULESET_NAMES[sheet.ruleset] || sheet.ruleset}
              </Badge>
            )}
          </div>

          {isLoading || !sheet ? (
            <div className="text-sm text-muted-foreground">Loading character sheet…</div>
          ) : (
            <>
              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Shield className="w-4 h-4 text-sky-500" />
                    Ability Scores
                  </div>
                  <div className="text-xs text-muted-foreground">
                    AC <span className="font-semibold text-foreground">{ac}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => (
                    <div key={key} className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{ABILITY_LABELS[key]}</div>
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
                  {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => {
                    const save = sheet.saves[key];
                    return (
                      <div
                        key={key}
                        className={`rounded-lg border p-2 text-center ${save.proficient ? "border-primary/40 bg-primary/5" : "border-border"}`}
                      >
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{ABILITY_LABELS[key]}</div>
                        <div className="text-sm font-semibold">{fmt(save.total)}</div>
                      </div>
                    );
                  })}
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
                      <div
                        key={skill.name}
                        className="flex items-center justify-between text-sm rounded-md px-2 py-1 hover:bg-muted/50"
                      >
                        <span className="flex items-center gap-1.5">
                          {skill.proficient && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />}
                          {skill.name}
                          <span className="text-xs text-muted-foreground">({ABILITY_LABELS[skill.ability]})</span>
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
                    Feats & Features
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
      </DialogContent>
    </Dialog>
  );
}
