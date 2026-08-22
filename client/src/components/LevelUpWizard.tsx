import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Dices, Sparkles, XCircle } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import type { PublicDnd35Feat } from "@/lib/knowledge-library";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LevelUpOptions = {
  eligible: boolean;
  nextLevel: number;
  classes: string[];
  isAsiLevel: boolean;
  conModifier: number;
  ruleset?: string;
  grantsAbilityIncrease?: boolean;
  grantsFeat?: boolean;
  abilityIncreasePoints?: number;
  note?: string;
};

type LevelUpResponse = {
  character: { level: number; campaignId: number };
  hpGained: number;
  hpRoll: number | null;
  pendingLevelUps: number;
  canonicalFeat?: PublicDnd35Feat;
  dnd35LevelUp?: {
    nextLevel: number;
    abilityIncrease: { ability: string; amount: number } | null;
    feat: { id: string; name: string; parameters: Record<string, string | string[]> } | null;
  };
};

type EligibleFeatResponse = {
  edition: "3.5e";
  feats: PublicDnd35Feat[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: number;
  onDone?: () => void;
};

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilityKey = (typeof ABILITY_KEYS)[number];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};
const SPELL_SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"];

function featParameterPayload(feat: PublicDnd35Feat | undefined, values: Record<string, string>) {
  if (!feat?.parameters?.length) return undefined;
  const payload: Record<string, string | string[]> = {};
  for (const parameter of feat.parameters) {
    const value = (values[parameter.id] || "").trim();
    if (!value) continue;
    payload[parameter.id] = parameter.kind === "spell" && value.includes(",")
      ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
      : value;
  }
  return Object.keys(payload).length ? payload : undefined;
}

export default function LevelUpWizard({ open, onOpenChange, characterId, onDone }: Props) {
  const qc = useQueryClient();
  const [chosenClass, setChosenClass] = useState("");
  const [rollHp, setRollHp] = useState(false);

  // Legacy 5e choice state. D&D 3.5 uses the separate canonical controls below.
  const [asiMode, setAsiMode] = useState<"asi" | "feat">("asi");
  const [asiSplitMode, setAsiSplitMode] = useState<"single" | "split">("single");
  const [asiSingle, setAsiSingle] = useState<AbilityKey>("str");
  const [asiSplitA, setAsiSplitA] = useState<AbilityKey>("str");
  const [asiSplitB, setAsiSplitB] = useState<AbilityKey>("dex");
  const [feat, setFeat] = useState("");

  // D&D 3.5 choices are independent benefits, not an ASI-or-feat toggle.
  const [dnd35Ability, setDnd35Ability] = useState<AbilityKey>("str");
  const [dnd35FeatId, setDnd35FeatId] = useState("");
  const [dnd35FeatParameters, setDnd35FeatParameters] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<{ level: number; hpGained: number; hpRoll: number | null; featName?: string } | null>(null);

  const optionsQuery = useQuery<LevelUpOptions>({
    queryKey: [`/api/characters/${characterId}/level-up-options`],
    enabled: open,
  });
  const options = optionsQuery.data;
  const isDnd35 = options?.ruleset === "dnd35e";

  const featQuery = useQuery<EligibleFeatResponse>({
    queryKey: [`/api/knowledge/dnd35/characters/${characterId}/eligible-feats`],
    enabled: open && isDnd35 && options?.grantsFeat === true,
  });

  const dnd35Feats = useMemo(() => {
    const rows = featQuery.data?.feats ?? [];
    return [...rows].sort((a, b) => Number(Boolean(b.qualified)) - Number(Boolean(a.qualified)) || a.name.localeCompare(b.name));
  }, [featQuery.data]);
  const selectedDnd35Feat = dnd35Feats.find((candidate) => candidate.id === dnd35FeatId);

  useEffect(() => {
    if (options?.classes.length && !options.classes.includes(chosenClass)) {
      setChosenClass(options.classes[0]);
    }
  }, [options, chosenClass]);

  useEffect(() => {
    if (!open) {
      setLastResult(null);
      setRollHp(false);
      setAsiMode("asi");
      setAsiSplitMode("single");
      setFeat("");
      setDnd35Ability("str");
      setDnd35FeatId("");
      setDnd35FeatParameters({});
    }
  }, [open]);

  useEffect(() => {
    setDnd35FeatParameters({});
  }, [dnd35FeatId]);

  const levelUpMutation = useMutation({
    mutationFn: async (): Promise<LevelUpResponse> => {
      const body: Record<string, unknown> = { chosenClass, roll: rollHp };

      if (isDnd35) {
        if (options?.grantsAbilityIncrease) body.dnd35AbilityIncrease = dnd35Ability;
        if (options?.grantsFeat) {
          body.featId = dnd35FeatId;
          body.featParameters = featParameterPayload(selectedDnd35Feat, dnd35FeatParameters);
        }
      } else if (options?.isAsiLevel) {
        if (asiMode === "feat") {
          body.feat = feat.trim();
        } else {
          body.asi =
            asiSplitMode === "single"
              ? [{ ability: asiSingle, amount: 2 }]
              : [
                  { ability: asiSplitA, amount: 1 },
                  { ability: asiSplitB, amount: 1 },
                ];
        }
      }

      const res = await apiRequest("POST", `/api/characters/${characterId}/level-up`, body);
      return res.json();
    },
    onSuccess: async (data) => {
      setLastResult({
        level: data.character.level,
        hpGained: data.hpGained,
        hpRoll: data.hpRoll,
        featName: data.canonicalFeat?.name,
      });
      setFeat("");
      setDnd35FeatId("");
      setDnd35FeatParameters({});
      await Promise.all([
        qc.invalidateQueries({ queryKey: [`/api/characters/${characterId}/sheet`] }),
        qc.invalidateQueries({ queryKey: [`/api/characters/${characterId}/level-up-options`] }),
        qc.invalidateQueries({ queryKey: [`/api/knowledge/dnd35/characters/${characterId}/eligible-feats`] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", data.character.campaignId, "my-character"] }),
      ]);
      if (data.pendingLevelUps === 0) onDone?.();
    },
  });

  const legacyAsiValid =
    !options?.isAsiLevel ||
    (asiMode === "feat" ? feat.trim().length > 0 : asiSplitMode === "single" || asiSplitA !== asiSplitB);

  const dnd35ParametersValid = !selectedDnd35Feat?.parameters?.some((parameter) => parameter.required && !(dnd35FeatParameters[parameter.id] || "").trim());
  const dnd35FeatValid = !options?.grantsFeat || Boolean(selectedDnd35Feat?.qualified && dnd35ParametersValid);
  const choiceValid = isDnd35 ? dnd35FeatValid : legacyAsiValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Level Up
          </DialogTitle>
        </DialogHeader>

        {optionsQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !options?.eligible ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {lastResult ? `Level up complete — now level ${lastResult.level}.` : "Not eligible to level up yet."}
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Advancing to <strong>level {options.nextLevel}</strong>{isDnd35 ? " under D&D 3.5 rules" : ""}.
            </div>

            {options.classes.length > 1 && (
              <div>
                <label className="text-sm text-muted-foreground">Which class gains this level?</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={chosenClass} onChange={(e) => setChosenClass(e.target.value)}>
                  {options.classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <Card className="p-4 space-y-2">
              <div className="font-semibold text-sm">Hit Points</div>
              <div className="flex gap-2">
                <Button type="button" variant={!rollHp ? "default" : "outline"} size="sm" onClick={() => setRollHp(false)}>Take Average</Button>
                <Button type="button" variant={rollHp ? "default" : "outline"} size="sm" onClick={() => setRollHp(true)}>
                  <Dices className="w-4 h-4 mr-2" /> Roll
                </Button>
              </div>
            </Card>

            {isDnd35 ? (
              <>
                {options.grantsAbilityIncrease && (
                  <Card className="p-4 space-y-3">
                    <div className="font-semibold text-sm">D&D 3.5 Ability Increase</div>
                    <p className="text-xs text-muted-foreground">Level {options.nextLevel} grants <strong>+1 to one ability score</strong>. This is separate from any feat gained at this level.</p>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={dnd35Ability} onChange={(e) => setDnd35Ability(e.target.value as AbilityKey)}>
                      {ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]} +1</option>)}
                    </select>
                    {dnd35Ability === "con" && <p className="text-xs text-muted-foreground">If Constitution's modifier increases, DungeonMasterOS also recalculates the hit-point increase across existing hit dice.</p>}
                  </Card>
                )}

                {options.grantsFeat && (
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <BookOpen className="w-4 h-4 text-primary" /> D&D 3.5 General Feat
                    </div>
                    <p className="text-xs text-muted-foreground">Choose from the same canonical Feat Codex used by the Dungeon Master. Ineligible feats remain visible with the reason they cannot be selected.</p>

                    {featQuery.isLoading ? (
                      <div className="text-xs text-muted-foreground">Consulting the Feat Codex...</div>
                    ) : (
                      <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={dnd35FeatId} onChange={(e) => setDnd35FeatId(e.target.value)}>
                        <option value="">Choose a feat...</option>
                        {dnd35Feats.map((candidate) => (
                          <option key={candidate.id} value={candidate.id} disabled={!candidate.qualified}>
                            {candidate.qualified ? "✓" : "×"} {candidate.name}{candidate.selected && !candidate.repeatable ? " — already selected" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    {selectedDnd35Feat && (
                      <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {selectedDnd35Feat.qualified ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
                          {selectedDnd35Feat.name}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{selectedDnd35Feat.rulesSummary}</p>
                        {selectedDnd35Feat.prerequisiteSummary && <p className="text-xs"><strong>Prerequisite:</strong> {selectedDnd35Feat.prerequisiteSummary}</p>}
                        {!selectedDnd35Feat.qualified && selectedDnd35Feat.failures?.map((failure) => <p className="text-xs text-destructive" key={failure}>{failure}</p>)}

                        {selectedDnd35Feat.parameters?.map((parameter) => (
                          <div key={parameter.id} className="space-y-1">
                            <label className="text-xs font-medium capitalize">{parameter.id.replaceAll("_", " ")}{parameter.required ? " *" : ""}</label>
                            {parameter.kind === "spell_school" ? (
                              <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={dnd35FeatParameters[parameter.id] || ""} onChange={(e) => setDnd35FeatParameters((current) => ({ ...current, [parameter.id]: e.target.value }))}>
                                <option value="">Choose a school...</option>
                                {SPELL_SCHOOLS.map((school) => <option key={school} value={school}>{school.replace(/^./, (letter) => letter.toUpperCase())}</option>)}
                              </select>
                            ) : (
                              <Input
                                value={dnd35FeatParameters[parameter.id] || ""}
                                onChange={(e) => setDnd35FeatParameters((current) => ({ ...current, [parameter.id]: e.target.value }))}
                                placeholder={parameter.kind === "spell" ? "Spell name(s), separated by commas" : `Choose ${parameter.id}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {!options.grantsAbilityIncrease && !options.grantsFeat && (
                  <Card className="p-4 text-xs text-muted-foreground">
                    This D&D 3.5 level grants no general feat or universal ability-score increase. Class-specific features still advance with the selected class.
                  </Card>
                )}
              </>
            ) : options.isAsiLevel ? (
              <Card className="p-4 space-y-3">
                <div className="font-semibold text-sm">Ability Score Improvement or Feat</div>
                <div className="flex gap-2">
                  <Button type="button" variant={asiMode === "asi" ? "default" : "outline"} size="sm" onClick={() => setAsiMode("asi")}>Ability Score</Button>
                  <Button type="button" variant={asiMode === "feat" ? "default" : "outline"} size="sm" onClick={() => setAsiMode("feat")}>Feat</Button>
                </div>

                {asiMode === "asi" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button type="button" variant={asiSplitMode === "single" ? "default" : "outline"} size="sm" onClick={() => setAsiSplitMode("single")}>+2 to one</Button>
                      <Button type="button" variant={asiSplitMode === "split" ? "default" : "outline"} size="sm" onClick={() => setAsiSplitMode("split")}>+1 to two</Button>
                    </div>
                    {asiSplitMode === "single" ? (
                      <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={asiSingle} onChange={(e) => setAsiSingle(e.target.value as AbilityKey)}>
                        {ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]} +2</option>)}
                      </select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={asiSplitA} onChange={(e) => setAsiSplitA(e.target.value as AbilityKey)}>
                          {ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]} +1</option>)}
                        </select>
                        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={asiSplitB} onChange={(e) => setAsiSplitB(e.target.value as AbilityKey)}>
                          {ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]} +1</option>)}
                        </select>
                      </div>
                    )}
                    {asiSplitMode === "split" && asiSplitA === asiSplitB && <div className="text-xs text-destructive">Choose two different abilities.</div>}
                  </div>
                ) : (
                  <Input value={feat} onChange={(e) => setFeat(e.target.value)} placeholder="Feat name" />
                )}
              </Card>
            ) : null}

            {options.note && isDnd35 && <p className="text-[11px] leading-relaxed text-muted-foreground">{options.note}</p>}

            {lastResult && (
              <div className="text-sm text-emerald-600">
                Reached level {lastResult.level}: +{lastResult.hpGained} HP{lastResult.hpRoll !== null ? ` (rolled ${lastResult.hpRoll})` : " (average)"}{lastResult.featName ? ` · ${lastResult.featName} added from the Feat Codex` : ""}.
              </div>
            )}

            {levelUpMutation.isError && (
              <div className="text-sm text-destructive">{levelUpMutation.error instanceof Error ? levelUpMutation.error.message : "The level-up could not be applied."}</div>
            )}

            <Button className="w-full" disabled={!chosenClass || !choiceValid || levelUpMutation.isPending} onClick={() => levelUpMutation.mutate()}>
              {levelUpMutation.isPending ? "Applying..." : "Confirm Level Up"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
