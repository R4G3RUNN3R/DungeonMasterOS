import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Dices } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
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
};

type LevelUpResponse = {
  character: { level: number; campaignId: number };
  hpGained: number;
  hpRoll: number | null;
  pendingLevelUps: number;
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

export default function LevelUpWizard({ open, onOpenChange, characterId, onDone }: Props) {
  const qc = useQueryClient();
  const [chosenClass, setChosenClass] = useState("");
  const [rollHp, setRollHp] = useState(false);
  const [asiMode, setAsiMode] = useState<"asi" | "feat">("asi");
  const [asiSplitMode, setAsiSplitMode] = useState<"single" | "split">("single");
  const [asiSingle, setAsiSingle] = useState<AbilityKey>("str");
  const [asiSplitA, setAsiSplitA] = useState<AbilityKey>("str");
  const [asiSplitB, setAsiSplitB] = useState<AbilityKey>("dex");
  const [feat, setFeat] = useState("");
  const [lastResult, setLastResult] = useState<{ level: number; hpGained: number; hpRoll: number | null } | null>(null);

  const optionsQuery = useQuery<LevelUpOptions>({
    queryKey: [`/api/characters/${characterId}/level-up-options`],
    enabled: open,
  });
  const options = optionsQuery.data;

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
    }
  }, [open]);

  const levelUpMutation = useMutation({
    mutationFn: async (): Promise<LevelUpResponse> => {
      const body: Record<string, unknown> = { chosenClass, roll: rollHp };
      if (options?.isAsiLevel) {
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
      setLastResult({ level: data.character.level, hpGained: data.hpGained, hpRoll: data.hpRoll });
      setFeat("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: [`/api/characters/${characterId}/sheet`] }),
        qc.invalidateQueries({ queryKey: [`/api/characters/${characterId}/level-up-options`] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", data.character.campaignId, "my-character"] }),
      ]);
      if (data.pendingLevelUps === 0) onDone?.();
    },
  });

  const asiValid =
    !options?.isAsiLevel ||
    (asiMode === "feat" ? feat.trim().length > 0 : asiSplitMode === "single" || asiSplitA !== asiSplitB);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Advancing to <strong>level {options.nextLevel}</strong>.
            </div>

            {options.classes.length > 1 && (
              <div>
                <label className="text-sm text-muted-foreground">Which class gains this level?</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={chosenClass}
                  onChange={(e) => setChosenClass(e.target.value)}
                >
                  {options.classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Card className="p-4 space-y-2">
              <div className="font-semibold text-sm">Hit Points</div>
              <div className="flex gap-2">
                <Button type="button" variant={!rollHp ? "default" : "outline"} size="sm" onClick={() => setRollHp(false)}>
                  Take Average
                </Button>
                <Button type="button" variant={rollHp ? "default" : "outline"} size="sm" onClick={() => setRollHp(true)}>
                  <Dices className="w-4 h-4 mr-2" />
                  Roll
                </Button>
              </div>
            </Card>

            {options.isAsiLevel && (
              <Card className="p-4 space-y-3">
                <div className="font-semibold text-sm">Ability Score Improvement or Feat</div>
                <div className="flex gap-2">
                  <Button type="button" variant={asiMode === "asi" ? "default" : "outline"} size="sm" onClick={() => setAsiMode("asi")}>
                    Ability Score
                  </Button>
                  <Button type="button" variant={asiMode === "feat" ? "default" : "outline"} size="sm" onClick={() => setAsiMode("feat")}>
                    Feat
                  </Button>
                </div>

                {asiMode === "asi" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={asiSplitMode === "single" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAsiSplitMode("single")}
                      >
                        +2 to one
                      </Button>
                      <Button
                        type="button"
                        variant={asiSplitMode === "split" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAsiSplitMode("split")}
                      >
                        +1 to two
                      </Button>
                    </div>
                    {asiSplitMode === "single" ? (
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={asiSingle}
                        onChange={(e) => setAsiSingle(e.target.value as AbilityKey)}
                      >
                        {ABILITY_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {ABILITY_LABELS[k]} +2
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={asiSplitA}
                          onChange={(e) => setAsiSplitA(e.target.value as AbilityKey)}
                        >
                          {ABILITY_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {ABILITY_LABELS[k]} +1
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={asiSplitB}
                          onChange={(e) => setAsiSplitB(e.target.value as AbilityKey)}
                        >
                          {ABILITY_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {ABILITY_LABELS[k]} +1
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {asiSplitMode === "split" && asiSplitA === asiSplitB && (
                      <div className="text-xs text-destructive">Choose two different abilities.</div>
                    )}
                  </div>
                ) : (
                  <Input value={feat} onChange={(e) => setFeat(e.target.value)} placeholder="Feat name" />
                )}
              </Card>
            )}

            {lastResult && (
              <div className="text-sm text-emerald-600">
                Reached level {lastResult.level}: +{lastResult.hpGained} HP
                {lastResult.hpRoll !== null ? ` (rolled ${lastResult.hpRoll})` : " (average)"}.
              </div>
            )}

            <Button
              className="w-full"
              disabled={!chosenClass || !asiValid || levelUpMutation.isPending}
              onClick={() => levelUpMutation.mutate()}
            >
              {levelUpMutation.isPending ? "Applying..." : "Confirm Level Up"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
