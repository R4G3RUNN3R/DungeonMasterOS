import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import type {
  Dnd35Ability,
  Dnd35CharacterSheetData,
  Dnd35SkillEntry,
  Dnd35SpellcastingBlock,
} from "@shared/dnd35-character-sheet";

type Character = {
  id: number;
  campaignId: number;
  name: string;
  race: string;
  charClass: string;
  traits: string;
  backstory: string;
  level: number;
  hp: number;
  maxHp: number;
  tempHp: number;
  speed: number;
  attacksPerRound: number;
  status: string;
  characterData: string;
};

type Campaign = {
  id: number;
  name: string;
};

type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
  locationNote?: string;
};

type CurrencyBalance = {
  currencyCode: string;
  amount: number;
};

type CampaignCurrency = {
  code: string;
  name: string;
  symbol: string;
  isPrimary: boolean;
};

type RawEntry = {
  key?: string;
  name?: string;
  value?: string;
  description?: string;
};

type RawSection = {
  label?: string;
  type?: string;
  entries?: RawEntry[];
};

type ParsedCharacterData = {
  dnd35Sheet?: Dnd35CharacterSheetData;
  rulesProfile?: any;
  sections?: RawSection[];
  [key: string]: any;
};

type SkillDefinition = {
  name: string;
  ability: Dnd35Ability | "none";
  trainedOnly?: boolean;
  armorCheckPenalty?: boolean;
};

const ABILITIES: Array<{ key: Dnd35Ability; short: string; label: string }> = [
  { key: "str", short: "STR", label: "Strength" },
  { key: "dex", short: "DEX", label: "Dexterity" },
  { key: "con", short: "CON", label: "Constitution" },
  { key: "int", short: "INT", label: "Intelligence" },
  { key: "wis", short: "WIS", label: "Wisdom" },
  { key: "cha", short: "CHA", label: "Charisma" },
];

const CORE_SKILLS: SkillDefinition[] = [
  { name: "Appraise", ability: "int" },
  { name: "Balance", ability: "dex", armorCheckPenalty: true },
  { name: "Bluff", ability: "cha" },
  { name: "Climb", ability: "str", armorCheckPenalty: true },
  { name: "Concentration", ability: "con" },
  { name: "Craft (________)", ability: "int" },
  { name: "Decipher Script", ability: "int", trainedOnly: true },
  { name: "Diplomacy", ability: "cha" },
  { name: "Disable Device", ability: "int", trainedOnly: true },
  { name: "Disguise", ability: "cha" },
  { name: "Escape Artist", ability: "dex", armorCheckPenalty: true },
  { name: "Forgery", ability: "int" },
  { name: "Gather Information", ability: "cha" },
  { name: "Handle Animal", ability: "cha", trainedOnly: true },
  { name: "Heal", ability: "wis" },
  { name: "Hide", ability: "dex", armorCheckPenalty: true },
  { name: "Intimidate", ability: "cha" },
  { name: "Jump", ability: "str", armorCheckPenalty: true },
  { name: "Knowledge (arcana)", ability: "int", trainedOnly: true },
  { name: "Knowledge (architecture and engineering)", ability: "int", trainedOnly: true },
  { name: "Knowledge (dungeoneering)", ability: "int", trainedOnly: true },
  { name: "Knowledge (geography)", ability: "int", trainedOnly: true },
  { name: "Knowledge (history)", ability: "int", trainedOnly: true },
  { name: "Knowledge (local)", ability: "int", trainedOnly: true },
  { name: "Knowledge (nature)", ability: "int", trainedOnly: true },
  { name: "Knowledge (nobility and royalty)", ability: "int", trainedOnly: true },
  { name: "Knowledge (religion)", ability: "int", trainedOnly: true },
  { name: "Knowledge (the planes)", ability: "int", trainedOnly: true },
  { name: "Listen", ability: "wis" },
  { name: "Move Silently", ability: "dex", armorCheckPenalty: true },
  { name: "Open Lock", ability: "dex", trainedOnly: true },
  { name: "Perform (________)", ability: "cha" },
  { name: "Profession (________)", ability: "wis", trainedOnly: true },
  { name: "Ride", ability: "dex" },
  { name: "Search", ability: "int" },
  { name: "Sense Motive", ability: "wis" },
  { name: "Sleight of Hand", ability: "dex", armorCheckPenalty: true },
  { name: "Speak Language", ability: "none", trainedOnly: true },
  { name: "Spellcraft", ability: "int", trainedOnly: true },
  { name: "Spot", ability: "wis" },
  { name: "Survival", ability: "wis" },
  { name: "Swim", ability: "str", armorCheckPenalty: true },
  { name: "Tumble", ability: "dex", trainedOnly: true, armorCheckPenalty: true },
  { name: "Use Magic Device", ability: "cha", trainedOnly: true },
  { name: "Use Rope", ability: "dex" },
];

const CLASS_SKILLS: Record<string, string[]> = {
  barbarian: ["Climb", "Craft", "Handle Animal", "Intimidate", "Jump", "Listen", "Ride", "Survival", "Swim"],
  bard: ["Appraise", "Balance", "Bluff", "Climb", "Concentration", "Craft", "Decipher Script", "Diplomacy", "Disguise", "Escape Artist", "Gather Information", "Hide", "Jump", "Knowledge", "Listen", "Move Silently", "Perform", "Profession", "Sense Motive", "Sleight of Hand", "Speak Language", "Spellcraft", "Swim", "Tumble", "Use Magic Device"],
  cleric: ["Concentration", "Craft", "Diplomacy", "Heal", "Knowledge (arcana)", "Knowledge (history)", "Knowledge (religion)", "Knowledge (the planes)", "Profession", "Spellcraft"],
  druid: ["Concentration", "Craft", "Diplomacy", "Handle Animal", "Heal", "Knowledge (nature)", "Listen", "Profession", "Ride", "Spellcraft", "Spot", "Survival", "Swim"],
  fighter: ["Climb", "Craft", "Handle Animal", "Intimidate", "Jump", "Ride", "Swim"],
  monk: ["Balance", "Climb", "Concentration", "Craft", "Diplomacy", "Escape Artist", "Hide", "Jump", "Knowledge (arcana)", "Knowledge (religion)", "Listen", "Move Silently", "Perform", "Profession", "Sense Motive", "Spot", "Swim", "Tumble"],
  paladin: ["Concentration", "Craft", "Diplomacy", "Handle Animal", "Heal", "Knowledge (nobility and royalty)", "Knowledge (religion)", "Profession", "Ride", "Sense Motive"],
  ranger: ["Climb", "Concentration", "Craft", "Handle Animal", "Heal", "Hide", "Jump", "Knowledge (dungeoneering)", "Knowledge (geography)", "Knowledge (nature)", "Listen", "Move Silently", "Profession", "Ride", "Search", "Spot", "Survival", "Swim", "Use Rope"],
  rogue: ["Appraise", "Balance", "Bluff", "Climb", "Craft", "Decipher Script", "Diplomacy", "Disable Device", "Disguise", "Escape Artist", "Forgery", "Gather Information", "Hide", "Intimidate", "Jump", "Knowledge (local)", "Listen", "Move Silently", "Open Lock", "Perform", "Profession", "Search", "Sense Motive", "Sleight of Hand", "Spot", "Swim", "Tumble", "Use Magic Device", "Use Rope"],
  sorcerer: ["Bluff", "Concentration", "Craft", "Knowledge (arcana)", "Profession", "Spellcraft"],
  wizard: ["Concentration", "Craft", "Decipher Script", "Knowledge", "Profession", "Spellcraft"],
};

function safeParse(raw: string): ParsedCharacterData {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

function abilityModifier(score: number | undefined | null): number | undefined {
  if (score === undefined || score === null || Number.isNaN(score)) return undefined;
  return Math.floor((score - 10) / 2);
}

function signed(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value >= 0 ? `+${value}` : String(value);
}

function shown(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function normalizeSkillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\(________\)/g, "")
    .trim();
}

function skillFamily(name: string): string {
  const normalized = normalizeSkillName(name);
  if (normalized.startsWith("knowledge")) return "Knowledge";
  if (normalized.startsWith("craft")) return "Craft";
  if (normalized.startsWith("perform")) return "Perform";
  if (normalized.startsWith("profession")) return "Profession";
  return name.replace(/\s*\([^)]*\)\s*/g, "").trim();
}

function classSkillFor(charClass: string, skillName: string): boolean {
  const classes = charClass
    .split(/[\/,+]/)
    .map((part) => part.trim().toLowerCase().replace(/\s+\d+$/, ""))
    .filter(Boolean);

  const family = skillFamily(skillName).toLowerCase();
  const exact = normalizeSkillName(skillName);

  return classes.some((className) => {
    const list = CLASS_SKILLS[className] || [];
    return list.some((entry) => {
      const listed = normalizeSkillName(entry);
      return listed === exact || listed.toLowerCase() === family || (listed === "knowledge" && exact.startsWith("knowledge"));
    });
  });
}

function parseLegacySkill(text: string): Partial<Dnd35SkillEntry> & { name: string } {
  const rankMatch = text.match(/(\d+(?:\.5)?)\s*ranks?/i);
  const totalMatch = text.match(/;\s*([+-]\d+)/);
  const name = (rankMatch ? text.slice(0, rankMatch.index) : text.split(";")[0]).trim().replace(/[,:-]+$/, "");
  return {
    name,
    ranks: rankMatch ? Number(rankMatch[1]) : undefined,
    total: totalMatch ? Number(totalMatch[1]) : undefined,
  };
}

function findCoreSkillDefinition(name: string): SkillDefinition | undefined {
  const exact = normalizeSkillName(name);
  return CORE_SKILLS.find((skill) => {
    const candidate = normalizeSkillName(skill.name);
    if (candidate === exact) return true;
    const family = skillFamily(skill.name).toLowerCase();
    return ["knowledge", "craft", "perform", "profession"].includes(family) && exact.startsWith(family);
  });
}

function coreRaceSize(race: string): string | undefined {
  const value = race.toLowerCase();
  if (value.includes("halfling") || value.includes("gnome")) return "Small";
  if (["human", "elf", "dwarf", "half-elf", "half-orc"].some((raceName) => value === raceName || value.endsWith(` ${raceName}`))) {
    return "Medium";
  }
  return undefined;
}

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded border-2 border-stone-800 bg-[#f7f1df] shadow-sm ${className}`}>
      <div className="border-b-2 border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[#f7f1df]">
        {title}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function InfoBox({ label, value, className = "" }: { label: string; value: unknown; className?: string }) {
  return (
    <div className={`min-h-[52px] rounded border border-stone-500 bg-white/60 px-2 py-1 ${className}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="mt-1 min-h-5 text-sm font-semibold text-stone-950">{shown(value)}</div>
    </div>
  );
}

function NumberCell({ value }: { value: number | string | undefined | null }) {
  return <td className="border border-stone-400 px-2 py-1.5 text-center font-semibold">{shown(value)}</td>;
}

export default function CharacterSheetPage() {
  const [, params] = useRoute("/character-sheet/:id");
  const campaignId = Number(params?.id);
  const { user } = useAuth();

  const campaignQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "sheet-campaign"],
    queryFn: () => api<Campaign>(`/api/campaigns/${campaignId}`),
    enabled: Number.isFinite(campaignId),
    staleTime: 30_000,
  });

  const characterQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "sheet-character"],
    queryFn: () => api<Character>(`/api/campaigns/${campaignId}/my-character`),
    enabled: Number.isFinite(campaignId),
    refetchInterval: 5000,
  });

  const character = characterQuery.data;

  const itemsQuery = useQuery({
    queryKey: ["/api/characters", character?.id, "sheet-items"],
    queryFn: () => api<Item[]>(`/api/characters/${character!.id}/items`),
    enabled: !!character?.id,
    refetchInterval: 5000,
  });

  const campaignCurrenciesQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "sheet-currencies"],
    queryFn: () => api<CampaignCurrency[]>(`/api/campaigns/${campaignId}/currencies`),
    enabled: Number.isFinite(campaignId),
    refetchInterval: 5000,
  });

  const balancesQuery = useQuery({
    queryKey: ["/api/characters", character?.id, "sheet-balances"],
    queryFn: () => api<CurrencyBalance[]>(`/api/characters/${character!.id}/currencies`),
    enabled: !!character?.id,
    refetchInterval: 5000,
  });

  const parsed = useMemo(() => safeParse(character?.characterData || "{}"), [character?.characterData]);
  const sheet = parsed.dnd35Sheet;
  const rulesProfile = parsed.rulesProfile || {};
  const items = itemsQuery.data || [];
  const currencyDefs = campaignCurrenciesQuery.data || [];
  const balances = balancesQuery.data || [];

  const abilityScores = useMemo(() => {
    const result: Partial<Record<Dnd35Ability, number>> = {};
    for (const ability of ABILITIES) {
      const structured = sheet?.abilities?.[ability.key]?.score;
      const legacy = rulesProfile?.abilityScores?.[ability.key];
      if (typeof structured === "number") result[ability.key] = structured;
      else if (typeof legacy === "number") result[ability.key] = legacy;
    }
    return result;
  }, [sheet, rulesProfile]);

  const skillRows = useMemo(() => {
    const explicit = new Map<string, Dnd35SkillEntry>();
    for (const skill of sheet?.skills || []) {
      explicit.set(normalizeSkillName(skill.name), skill);
    }

    for (const raw of rulesProfile?.skills || []) {
      if (typeof raw !== "string") continue;
      const parsedSkill = parseLegacySkill(raw);
      const key = normalizeSkillName(parsedSkill.name);
      if (!explicit.has(key)) explicit.set(key, parsedSkill as Dnd35SkillEntry);
    }

    const rows: Array<SkillDefinition & Dnd35SkillEntry> = CORE_SKILLS.map((definition) => {
      const key = normalizeSkillName(definition.name);
      let chosen = explicit.get(key);
      if (!chosen) {
        const family = skillFamily(definition.name).toLowerCase();
        if (["knowledge", "craft", "perform", "profession"].includes(family)) {
          chosen = Array.from(explicit.values()).find((entry) => normalizeSkillName(entry.name).startsWith(family));
        }
      }
      const ability = chosen?.ability || definition.ability;
      const abilityMod = ability !== "none" ? abilityModifier(abilityScores[ability]) : undefined;
      return {
        ...definition,
        ...chosen,
        name: chosen?.name || definition.name,
        ability,
        abilityModifier: chosen?.abilityModifier ?? abilityMod,
        classSkill: chosen?.classSkill ?? (character ? classSkillFor(character.charClass, chosen?.name || definition.name) : false),
        trainedOnly: chosen?.trainedOnly ?? definition.trainedOnly,
      };
    });

    for (const entry of explicit.values()) {
      const alreadyShown = rows.some((row) => normalizeSkillName(row.name) === normalizeSkillName(entry.name));
      if (alreadyShown) continue;
      const definition = findCoreSkillDefinition(entry.name);
      const ability = entry.ability || definition?.ability || "none";
      rows.push({
        name: entry.name,
        ability,
        trainedOnly: entry.trainedOnly ?? definition?.trainedOnly,
        armorCheckPenalty: definition?.armorCheckPenalty,
        classSkill: entry.classSkill ?? (character ? classSkillFor(character.charClass, entry.name) : false),
        ranks: entry.ranks,
        abilityModifier: entry.abilityModifier ?? (ability !== "none" ? abilityModifier(abilityScores[ability]) : undefined),
        miscModifier: entry.miscModifier,
        armorCheckPenalty: entry.armorCheckPenalty ?? (definition?.armorCheckPenalty ? undefined : entry.armorCheckPenalty),
        total: entry.total,
        notes: entry.notes,
      });
    }

    return rows;
  }, [sheet, rulesProfile, abilityScores, character]);

  const feats = useMemo(() => {
    if (sheet?.feats?.length) return sheet.feats;
    return (rulesProfile?.feats || []).map((name: string) => ({ name, source: "Feat" }));
  }, [sheet, rulesProfile]);

  const specialAbilities = useMemo(() => {
    if (sheet?.specialAbilities?.length) return sheet.specialAbilities;
    const classFeatures = (rulesProfile?.classFeatures || []).map((description: string) => ({
      name: description.split(":")[0],
      source: "Class",
      description,
    }));
    const racialTraits = (rulesProfile?.racialTraits || []).map((description: string) => ({
      name: description.split(":")[0],
      source: "Race",
      description,
    }));
    return [...classFeatures, ...racialTraits];
  }, [sheet, rulesProfile]);

  const spellcasting = useMemo<Dnd35SpellcastingBlock[]>(() => {
    if (sheet?.spellcasting?.length) return sheet.spellcasting;
    const legacy = rulesProfile?.spellcasting;
    if (!legacy || !character) return [];
    const spells = [
      ...(legacy.cantrips || []).map((name: string) => ({ name, level: 0 })),
      ...(legacy.levelOneSpells || []).map((name: string) => ({ name, level: 1 })),
    ];
    return [{
      casterClass: character.charClass,
      casterLevel: character.level,
      castingAbility: legacy.ability,
      spells,
      notes: legacy.notes,
    }];
  }, [sheet, rulesProfile, character]);

  if (!Number.isFinite(campaignId)) {
    return <div className="min-h-screen bg-stone-200 p-8 text-stone-950">Invalid campaign.</div>;
  }

  if (characterQuery.isLoading) {
    return <div className="min-h-screen bg-stone-200 p-8 text-stone-950">Loading character sheet...</div>;
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-stone-200 p-8 text-stone-950">
        <div className="mx-auto max-w-xl rounded border border-stone-500 bg-white p-6">
          This campaign does not currently have a character for this account.
        </div>
      </div>
    );
  }

  const identity = sheet?.identity || {};
  const armorClass = sheet?.combat?.armorClass;
  const initiativeTotal = sheet?.combat?.initiative?.total ?? rulesProfile?.initiative;
  const dexModifier = abilityModifier(abilityScores.dex);
  const initiativeMisc = sheet?.combat?.initiative?.miscModifier ?? (
    typeof initiativeTotal === "number" && typeof dexModifier === "number" ? initiativeTotal - dexModifier : undefined
  );
  const baseAttackBonus = sheet?.combat?.baseAttackBonus ?? rulesProfile?.baseAttackBonus;
  const saveTotals = rulesProfile?.saves || {};
  const size = identity.size || coreRaceSize(character.race);
  const classLevels = identity.classes?.length
    ? identity.classes.map((entry) => `${entry.className} ${entry.level}`).join(" / ")
    : `${character.charClass} ${character.level}`;

  const structuredWeapons = sheet?.combat?.weapons || [];
  const weaponItems = items.filter((item) => item.itemType.toLowerCase() === "weapon");
  const armorRows = sheet?.equipment?.armor || [];
  const armorItems = items.filter((item) => item.itemType.toLowerCase() === "armor");
  const gearItems = items.filter((item) => !["weapon", "armor"].includes(item.itemType.toLowerCase()));

  const wealth = sheet?.equipment?.wealth?.length
    ? sheet.equipment.wealth
    : balances.map((balance) => {
        const def = currencyDefs.find((entry) => entry.code === balance.currencyCode);
        return {
          code: balance.currencyCode,
          name: def?.name,
          symbol: def?.symbol,
          amount: balance.amount,
        };
      });

  const saveRows = [
    { key: "fortitude" as const, label: "Fortitude", ability: "con" as Dnd35Ability, legacy: saveTotals.fort },
    { key: "reflex" as const, label: "Reflex", ability: "dex" as Dnd35Ability, legacy: saveTotals.ref },
    { key: "will" as const, label: "Will", ability: "wis" as Dnd35Ability, legacy: saveTotals.will },
  ];

  return (
    <div className="min-h-screen bg-[#d6cfbf] px-3 py-4 text-stone-950 print:bg-white print:p-0">
      <style>{`
        @media print {
          .sheet-controls { display: none !important; }
          .sheet-page { max-width: none !important; box-shadow: none !important; }
          section { break-inside: avoid; }
          table { break-inside: auto; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="sheet-controls fixed right-4 top-4 z-50 flex gap-2">
        <Button variant="outline" onClick={() => window.print()}>Print</Button>
        <Button variant="outline" onClick={() => window.close()}>Close</Button>
      </div>

      <main className="sheet-page mx-auto max-w-[1500px] space-y-3 rounded-lg border border-stone-500 bg-[#eee6d3] p-4 shadow-2xl print:border-0 print:bg-white">
        <header className="rounded border-2 border-stone-900 bg-[#f7f1df] p-3">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-stone-900 pb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-500">DungeonMasterOS Character Record</div>
              <h1 className="font-serif text-3xl font-black tracking-tight">{character.name}</h1>
              <div className="mt-1 text-sm text-stone-600">
                D&D 3.5e · {campaignQuery.data?.name || "Campaign"} · read-only live sheet
              </div>
            </div>
            <div className="text-right text-xs text-stone-600">
              <div>Status: <strong className="text-stone-900">{character.status}</strong></div>
              <div>Unrecorded values display as <strong>—</strong>.</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <InfoBox label="Player" value={identity.playerName || user?.username} />
            <InfoBox label="Character Name" value={identity.characterName || character.name} className="md:col-span-2" />
            <InfoBox label="Class & Level" value={classLevels} className="md:col-span-2" />
            <InfoBox label="Race" value={identity.race || character.race} />
            <InfoBox label="Alignment" value={identity.alignment || rulesProfile?.alignment} />
            <InfoBox label="Deity" value={identity.deity} />
            <InfoBox label="Size" value={size} />
            <InfoBox label="Age" value={identity.age} />
            <InfoBox label="Gender" value={identity.gender} />
            <InfoBox label="Height" value={identity.height} />
            <InfoBox label="Weight" value={identity.weight} />
            <InfoBox label="Eyes" value={identity.eyes} />
            <InfoBox label="Hair" value={identity.hair} />
            <InfoBox label="Skin" value={identity.skin} />
            <InfoBox label="Experience" value={identity.experiencePoints} />
            <InfoBox label="Next Level" value={identity.nextLevelExperience} />
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <Section title="Ability Scores">
              <div className="space-y-2">
                {ABILITIES.map((ability) => {
                  const score = abilityScores[ability.key];
                  const temporaryScore = sheet?.abilities?.[ability.key]?.temporaryScore;
                  return (
                    <div key={ability.key} className="grid grid-cols-[72px_1fr_1fr_1fr_1fr] items-center gap-1 rounded border border-stone-400 bg-white/50 p-1.5">
                      <div>
                        <div className="text-lg font-black">{ability.short}</div>
                        <div className="text-[9px] uppercase text-stone-500">{ability.label}</div>
                      </div>
                      <InfoBox label="Score" value={score} />
                      <InfoBox label="Mod" value={signed(abilityModifier(score))} />
                      <InfoBox label="Temp" value={temporaryScore} />
                      <InfoBox label="Temp Mod" value={temporaryScore == null ? undefined : signed(abilityModifier(temporaryScore))} />
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Hit Points & Movement">
              <div className="grid grid-cols-2 gap-2">
                <InfoBox label="Current HP" value={sheet?.hitPoints?.current ?? character.hp} />
                <InfoBox label="Maximum HP" value={sheet?.hitPoints?.maximum ?? character.maxHp} />
                <InfoBox label="Temporary HP" value={sheet?.hitPoints?.temporary ?? character.tempHp} />
                <InfoBox label="Nonlethal Damage" value={sheet?.hitPoints?.nonlethalDamage} />
                <InfoBox label="Hit Dice" value={sheet?.hitPoints?.hitDice} />
                <InfoBox label="Land Speed" value={`${sheet?.movement?.land ?? character.speed} ft.`} />
                <InfoBox label="Fly" value={sheet?.movement?.fly == null ? undefined : `${sheet.movement.fly} ft.`} />
                <InfoBox label="Swim" value={sheet?.movement?.swim == null ? undefined : `${sheet.movement.swim} ft.`} />
                <InfoBox label="Climb" value={sheet?.movement?.climb == null ? undefined : `${sheet.movement.climb} ft.`} />
                <InfoBox label="Burrow" value={sheet?.movement?.burrow == null ? undefined : `${sheet.movement.burrow} ft.`} />
              </div>
              {(sheet?.hitPoints?.woundsOrNotes || sheet?.movement?.notes) && (
                <div className="mt-2 rounded border border-stone-400 bg-white/50 p-2 text-xs whitespace-pre-wrap">
                  {[sheet?.hitPoints?.woundsOrNotes, sheet?.movement?.notes].filter(Boolean).join("\n")}
                </div>
              )}
            </Section>

            <Section title="Armor Class">
              <div className="grid grid-cols-3 gap-2">
                <InfoBox label="AC Total" value={armorClass?.total ?? rulesProfile?.armorClass} />
                <InfoBox label="Touch AC" value={armorClass?.touch} />
                <InfoBox label="Flat-Footed" value={armorClass?.flatFooted} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center md:grid-cols-5 xl:grid-cols-3">
                <InfoBox label="Armor" value={armorClass?.armorBonus} />
                <InfoBox label="Shield" value={armorClass?.shieldBonus} />
                <InfoBox label="Dex" value={armorClass?.dexModifier ?? dexModifier} />
                <InfoBox label="Size" value={armorClass?.sizeModifier} />
                <InfoBox label="Natural" value={armorClass?.naturalArmor} />
                <InfoBox label="Deflection" value={armorClass?.deflectionBonus} />
                <InfoBox label="Dodge" value={armorClass?.dodgeBonus} />
                <InfoBox label="Misc" value={armorClass?.miscModifier} />
                <InfoBox label="Temporary" value={armorClass?.temporaryModifier} />
              </div>
            </Section>

            <Section title="Initiative, BAB & Grapple">
              <div className="grid grid-cols-2 gap-2">
                <InfoBox label="Initiative" value={signed(initiativeTotal)} />
                <InfoBox label="Dex Modifier" value={signed(sheet?.combat?.initiative?.dexModifier ?? dexModifier)} />
                <InfoBox label="Initiative Misc" value={signed(initiativeMisc)} />
                <InfoBox label="Base Attack Bonus" value={signed(baseAttackBonus)} />
                <InfoBox label="Grapple Total" value={signed(sheet?.combat?.grapple?.total)} />
                <InfoBox label="Attacks / Round" value={sheet?.combat?.attacksPerRound ?? character.attacksPerRound} />
                <InfoBox label="Spell Resistance" value={sheet?.combat?.spellResistance} />
                <InfoBox label="Damage Reduction" value={sheet?.combat?.damageReduction} />
              </div>
            </Section>
          </div>

          <div className="space-y-3">
            <Section title="Saving Throws">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-200 text-[10px] uppercase tracking-wider">
                      <th className="border border-stone-400 px-2 py-1 text-left">Save</th>
                      <th className="border border-stone-400 px-2 py-1">Total</th>
                      <th className="border border-stone-400 px-2 py-1">Base</th>
                      <th className="border border-stone-400 px-2 py-1">Ability</th>
                      <th className="border border-stone-400 px-2 py-1">Magic</th>
                      <th className="border border-stone-400 px-2 py-1">Misc</th>
                      <th className="border border-stone-400 px-2 py-1">Temp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saveRows.map((row) => {
                      const structured = sheet?.saves?.[row.key];
                      const abilityMod = abilityModifier(abilityScores[row.ability]);
                      const total = structured?.total ?? row.legacy;
                      return (
                        <tr key={row.key}>
                          <td className="border border-stone-400 px-2 py-2 font-bold">{row.label} <span className="text-stone-500">({row.ability.toUpperCase()})</span></td>
                          <NumberCell value={signed(total)} />
                          <NumberCell value={signed(structured?.baseSave)} />
                          <NumberCell value={signed(structured?.abilityModifier ?? abilityMod)} />
                          <NumberCell value={signed(structured?.magicModifier)} />
                          <NumberCell value={signed(structured?.miscModifier)} />
                          <NumberCell value={signed(structured?.temporaryModifier)} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Weapons & Attacks">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-200 text-[10px] uppercase tracking-wider">
                      <th className="border border-stone-400 px-2 py-1 text-left">Weapon</th>
                      <th className="border border-stone-400 px-2 py-1">Attack Bonus</th>
                      <th className="border border-stone-400 px-2 py-1">Damage</th>
                      <th className="border border-stone-400 px-2 py-1">Critical</th>
                      <th className="border border-stone-400 px-2 py-1">Range</th>
                      <th className="border border-stone-400 px-2 py-1">Type</th>
                      <th className="border border-stone-400 px-2 py-1 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structuredWeapons.length > 0 ? structuredWeapons.map((weapon, index) => (
                      <tr key={`${weapon.name}-${index}`}>
                        <td className="border border-stone-400 px-2 py-1.5 font-semibold">{weapon.name}</td>
                        <NumberCell value={weapon.attackBonus} />
                        <NumberCell value={weapon.damage} />
                        <NumberCell value={weapon.critical} />
                        <NumberCell value={weapon.range} />
                        <NumberCell value={weapon.damageType} />
                        <td className="border border-stone-400 px-2 py-1.5">{shown(weapon.notes)}</td>
                      </tr>
                    )) : weaponItems.length > 0 ? weaponItems.map((item) => (
                      <tr key={item.id}>
                        <td className="border border-stone-400 px-2 py-1.5 font-semibold">{item.name}{item.equipped ? " · equipped" : ""}</td>
                        <NumberCell value={undefined} />
                        <NumberCell value={undefined} />
                        <NumberCell value={undefined} />
                        <NumberCell value={undefined} />
                        <NumberCell value={undefined} />
                        <td className="border border-stone-400 px-2 py-1.5">{shown(item.description)}</td>
                      </tr>
                    )) : (
                      <tr><td className="border border-stone-400 px-2 py-3 text-center text-stone-500" colSpan={7}>No weapons recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Skills">
              <div className="max-h-[720px] overflow-auto print:max-h-none print:overflow-visible">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 bg-stone-200 print:static">
                    <tr className="text-[9px] uppercase tracking-wider">
                      <th className="border border-stone-400 px-1 py-1">CS</th>
                      <th className="border border-stone-400 px-2 py-1 text-left">Skill</th>
                      <th className="border border-stone-400 px-1 py-1">Ability</th>
                      <th className="border border-stone-400 px-1 py-1">Total</th>
                      <th className="border border-stone-400 px-1 py-1">Ranks</th>
                      <th className="border border-stone-400 px-1 py-1">Ability Mod</th>
                      <th className="border border-stone-400 px-1 py-1">Misc</th>
                      <th className="border border-stone-400 px-1 py-1">ACP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skillRows.map((skill, index) => (
                      <tr key={`${skill.name}-${index}`} className={skill.ranks ? "bg-amber-50/70" : ""}>
                        <td className="border border-stone-400 px-1 py-1 text-center font-bold">{skill.classSkill ? "●" : ""}</td>
                        <td className="border border-stone-400 px-2 py-1 font-medium">
                          {skill.name}{skill.trainedOnly ? <span className="ml-1 text-[9px] text-stone-500">†</span> : null}
                        </td>
                        <td className="border border-stone-400 px-1 py-1 text-center uppercase">{skill.ability === "none" ? "—" : skill.ability}</td>
                        <td className="border border-stone-400 px-1 py-1 text-center font-bold">{signed(skill.total)}</td>
                        <td className="border border-stone-400 px-1 py-1 text-center">{shown(skill.ranks)}</td>
                        <td className="border border-stone-400 px-1 py-1 text-center">{signed(skill.abilityModifier)}</td>
                        <td className="border border-stone-400 px-1 py-1 text-center">{signed(skill.miscModifier)}</td>
                        <td className="border border-stone-400 px-1 py-1 text-center">{skill.armorCheckPenalty ? signed(skill.armorCheckPenalty) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-[10px] text-stone-500">● class skill · † trained-only or special training requirement · ACP = armor check penalty</div>
              </div>
            </Section>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Section title="Feats">
            {feats.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {feats.map((feat, index) => (
                  <div key={`${feat.name}-${index}`} className="rounded border border-stone-400 bg-white/50 p-2">
                    <div className="font-bold">{feat.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-500">{feat.source || "Feat"}</div>
                    {feat.description && <div className="mt-1 text-xs whitespace-pre-wrap">{feat.description}</div>}
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-stone-500">No feats recorded yet.</div>}
          </Section>

          <Section title="Special Abilities, Class Features & Racial Traits">
            {specialAbilities.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {specialAbilities.map((ability, index) => (
                  <div key={`${ability.name}-${index}`} className="rounded border border-stone-400 bg-white/50 p-2">
                    <div className="font-bold">{ability.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-500">{ability.source || "Special Ability"}</div>
                    {ability.description && <div className="mt-1 text-xs whitespace-pre-wrap">{ability.description}</div>}
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-stone-500">No special abilities recorded yet.</div>}
          </Section>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Section title="Armor & Protective Gear">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-200 text-[9px] uppercase tracking-wider">
                    <th className="border border-stone-400 px-2 py-1 text-left">Armor / Shield</th>
                    <th className="border border-stone-400 px-1 py-1">Bonus</th>
                    <th className="border border-stone-400 px-1 py-1">Max Dex</th>
                    <th className="border border-stone-400 px-1 py-1">ACP</th>
                    <th className="border border-stone-400 px-1 py-1">ASF</th>
                    <th className="border border-stone-400 px-1 py-1">Speed</th>
                    <th className="border border-stone-400 px-1 py-1">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {armorRows.length > 0 ? armorRows.map((armor, index) => (
                    <tr key={`${armor.name}-${index}`}>
                      <td className="border border-stone-400 px-2 py-1.5 font-semibold">{armor.name}</td>
                      <NumberCell value={armor.armorBonus} />
                      <NumberCell value={armor.maxDexBonus} />
                      <NumberCell value={armor.armorCheckPenalty} />
                      <NumberCell value={armor.arcaneSpellFailure} />
                      <NumberCell value={armor.speed} />
                      <NumberCell value={armor.weight} />
                    </tr>
                  )) : armorItems.length > 0 ? armorItems.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-stone-400 px-2 py-1.5 font-semibold">{item.name}{item.equipped ? " · equipped" : ""}</td>
                      <NumberCell value={undefined} /><NumberCell value={undefined} /><NumberCell value={undefined} /><NumberCell value={undefined} /><NumberCell value={undefined} /><NumberCell value={undefined} />
                    </tr>
                  )) : <tr><td colSpan={7} className="border border-stone-400 px-2 py-3 text-center text-stone-500">No armor recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Equipment, Wealth & Encumbrance">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Gear</div>
                <div className="space-y-1">
                  {gearItems.length ? gearItems.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2 rounded border border-stone-400 bg-white/50 px-2 py-1 text-xs">
                      <div><strong>{item.name}</strong>{item.description ? <span className="text-stone-600"> · {item.description}</span> : null}</div>
                      <div className="shrink-0">×{item.quantity}</div>
                    </div>
                  )) : (sheet?.equipment?.gear || []).length ? sheet!.equipment!.gear!.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex justify-between gap-2 rounded border border-stone-400 bg-white/50 px-2 py-1 text-xs">
                      <div><strong>{item.name}</strong>{item.location ? <span className="text-stone-600"> · {item.location}</span> : null}</div>
                      <div className="shrink-0">×{item.quantity ?? 1}</div>
                    </div>
                  )) : <div className="text-xs text-stone-500">No gear recorded yet.</div>}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Wealth</div>
                <div className="space-y-1">
                  {wealth.length ? wealth.map((entry, index) => (
                    <div key={`${entry.code}-${index}`} className="flex justify-between rounded border border-stone-400 bg-white/50 px-2 py-1 text-xs">
                      <span>{entry.name || entry.code}</span>
                      <strong>{entry.symbol ? `${entry.symbol}${entry.amount}` : `${entry.amount} ${entry.code}`}</strong>
                    </div>
                  )) : <div className="text-xs text-stone-500">No wealth recorded yet.</div>}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <InfoBox label="Current Weight" value={sheet?.equipment?.encumbrance?.currentWeight} />
              <InfoBox label="Light Load" value={sheet?.equipment?.encumbrance?.lightLoad} />
              <InfoBox label="Medium Load" value={sheet?.equipment?.encumbrance?.mediumLoad} />
              <InfoBox label="Heavy Load" value={sheet?.equipment?.encumbrance?.heavyLoad} />
              <InfoBox label="Lift Over Head" value={sheet?.equipment?.encumbrance?.liftOverHead} />
              <InfoBox label="Lift Off Ground" value={sheet?.equipment?.encumbrance?.liftOffGround} />
              <InfoBox label="Push / Drag" value={sheet?.equipment?.encumbrance?.pushOrDrag} />
            </div>
          </Section>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Section title="Weapon, Armor & Other Proficiencies">
            <div className="space-y-3 text-sm">
              <InfoBox label="Weapons" value={sheet?.proficiencies?.weapons?.join(", ")} />
              <InfoBox label="Armor" value={sheet?.proficiencies?.armor?.join(", ")} />
              <InfoBox label="Shields" value={sheet?.proficiencies?.shields?.join(", ")} />
              <InfoBox label="Other" value={sheet?.proficiencies?.other?.join(", ")} />
            </div>
          </Section>

          <Section title="Languages">
            {sheet?.languages?.length ? (
              <div className="flex flex-wrap gap-2">
                {sheet.languages.map((language) => <span key={language} className="rounded border border-stone-400 bg-white/60 px-2 py-1 text-sm font-semibold">{language}</span>)}
              </div>
            ) : <div className="text-sm text-stone-500">No languages recorded yet.</div>}
          </Section>

          <Section title="Character Notes">
            <div className="space-y-2 text-xs">
              <div><strong>Traits:</strong><div className="mt-1 whitespace-pre-wrap text-stone-700">{sheet?.notes?.traits || character.traits || "—"}</div></div>
              <div><strong>Allies & Contacts:</strong><div className="mt-1 whitespace-pre-wrap text-stone-700">{sheet?.notes?.alliesAndContacts || "—"}</div></div>
              <div><strong>Enemies:</strong><div className="mt-1 whitespace-pre-wrap text-stone-700">{sheet?.notes?.enemies || "—"}</div></div>
            </div>
          </Section>
        </div>

        <Section title="Spellcasting">
          {spellcasting.length ? (
            <div className="space-y-4">
              {spellcasting.map((block, blockIndex) => {
                const castingMod = block.castingAbility ? abilityModifier(abilityScores[block.castingAbility]) : undefined;
                const levels = Array.from({ length: 10 }, (_, index) => index);
                return (
                  <div key={`${block.casterClass}-${blockIndex}`} className="rounded border border-stone-400 bg-white/40 p-3">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                      <InfoBox label="Caster Class" value={block.casterClass} />
                      <InfoBox label="Caster Level" value={block.casterLevel} />
                      <InfoBox label="Casting Ability" value={block.castingAbility?.toUpperCase()} />
                      <InfoBox label="Ability Modifier" value={signed(castingMod)} />
                      <InfoBox label="Domains" value={block.domains?.join(", ")} />
                      <InfoBox label="Specialization" value={block.specialization} />
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead><tr className="bg-stone-200 text-[9px] uppercase tracking-wider"><th className="border border-stone-400 px-1 py-1">Spell Level</th>{levels.map((level) => <th key={level} className="border border-stone-400 px-1 py-1">{level}</th>)}</tr></thead>
                        <tbody>
                          <tr><td className="border border-stone-400 px-2 py-1 font-semibold">Save DC</td>{levels.map((level) => <NumberCell key={level} value={block.spellSaveDcByLevel?.[String(level) as keyof typeof block.spellSaveDcByLevel] ?? (castingMod === undefined ? undefined : 10 + level + castingMod)} />)}</tr>
                          <tr><td className="border border-stone-400 px-2 py-1 font-semibold">Spells / Day</td>{levels.map((level) => <NumberCell key={level} value={block.spellsPerDay?.[String(level) as keyof typeof block.spellsPerDay]} />)}</tr>
                          <tr><td className="border border-stone-400 px-2 py-1 font-semibold">Bonus Spells</td>{levels.map((level) => <NumberCell key={level} value={block.bonusSpells?.[String(level) as keyof typeof block.bonusSpells]} />)}</tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {(block.spells || []).length ? block.spells!.map((spell, index) => (
                        <div key={`${spell.level}-${spell.name}-${index}`} className="rounded border border-stone-400 bg-white/60 p-2 text-xs">
                          <div className="flex justify-between gap-2"><strong>{spell.name}</strong><span>Lv {spell.level}</span></div>
                          <div className="mt-1 text-stone-600">{[spell.school, spell.known ? "known" : null, spell.prepared ? `prepared ×${spell.prepared}` : null].filter(Boolean).join(" · ") || "Recorded spell"}</div>
                          {spell.notes && <div className="mt-1 whitespace-pre-wrap">{spell.notes}</div>}
                        </div>
                      )) : <div className="text-sm text-stone-500">No spell list recorded yet.</div>}
                    </div>

                    {(block.notes || block.prohibitedSchools?.length) && (
                      <div className="mt-3 rounded border border-stone-400 bg-white/50 p-2 text-xs whitespace-pre-wrap">
                        {[block.prohibitedSchools?.length ? `Prohibited schools: ${block.prohibitedSchools.join(", ")}` : null, block.notes].filter(Boolean).join("\n")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <div className="text-sm text-stone-500">This character has no spellcasting data recorded.</div>}
        </Section>

        <Section title="Backstory & Campaign Notes">
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Backstory</div>
              <div className="min-h-32 rounded border border-stone-400 bg-white/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">{sheet?.notes?.backstory || character.backstory || "—"}</div>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Campaign Notes</div>
              <div className="min-h-32 rounded border border-stone-400 bg-white/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">{sheet?.notes?.campaignNotes || "—"}</div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
