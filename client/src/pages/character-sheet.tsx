import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
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

type Campaign = { id: number; name: string };
type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
};
type CurrencyBalance = { currencyCode: string; amount: number };
type CampaignCurrency = { code: string; name: string; symbol: string; isPrimary: boolean };

type ParsedCharacterData = {
  dnd35Sheet?: Dnd35CharacterSheetData;
  rulesProfile?: any;
  sections?: Array<{ label?: string; type?: string; entries?: Array<{ key?: string; name?: string; value?: string; description?: string }> }>;
};

type SkillDefinition = {
  name: string;
  ability: Dnd35Ability | "none";
  trainedOnly?: boolean;
  acpApplies?: boolean;
};

type SkillRow = SkillDefinition & {
  classSkill: boolean;
  ranks?: number;
  abilityModifier?: number;
  miscModifier?: number;
  armorCheckPenalty?: number;
  total?: number;
  notes?: string;
};

type SpellLevelKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

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
  { name: "Balance", ability: "dex", acpApplies: true },
  { name: "Bluff", ability: "cha" },
  { name: "Climb", ability: "str", acpApplies: true },
  { name: "Concentration", ability: "con" },
  { name: "Craft (________)", ability: "int" },
  { name: "Decipher Script", ability: "int", trainedOnly: true },
  { name: "Diplomacy", ability: "cha" },
  { name: "Disable Device", ability: "int", trainedOnly: true },
  { name: "Disguise", ability: "cha" },
  { name: "Escape Artist", ability: "dex", acpApplies: true },
  { name: "Forgery", ability: "int" },
  { name: "Gather Information", ability: "cha" },
  { name: "Handle Animal", ability: "cha", trainedOnly: true },
  { name: "Heal", ability: "wis" },
  { name: "Hide", ability: "dex", acpApplies: true },
  { name: "Intimidate", ability: "cha" },
  { name: "Jump", ability: "str", acpApplies: true },
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
  { name: "Move Silently", ability: "dex", acpApplies: true },
  { name: "Open Lock", ability: "dex", trainedOnly: true },
  { name: "Perform (________)", ability: "cha" },
  { name: "Profession (________)", ability: "wis", trainedOnly: true },
  { name: "Ride", ability: "dex" },
  { name: "Search", ability: "int" },
  { name: "Sense Motive", ability: "wis" },
  { name: "Sleight of Hand", ability: "dex", acpApplies: true },
  { name: "Speak Language", ability: "none", trainedOnly: true },
  { name: "Spellcraft", ability: "int", trainedOnly: true },
  { name: "Spot", ability: "wis" },
  { name: "Survival", ability: "wis" },
  { name: "Swim", ability: "str", acpApplies: true },
  { name: "Tumble", ability: "dex", trainedOnly: true, acpApplies: true },
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
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(await response.text() || `Request failed: ${response.status}`);
  return response.json();
}

function modifier(score: number | undefined | null): number | undefined {
  return typeof score === "number" ? Math.floor((score - 10) / 2) : undefined;
}

function signed(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value >= 0 ? `+${value}` : String(value);
}

function show(value: unknown): string {
  return value === undefined || value === null || value === "" ? "—" : String(value);
}

function normalizeSkill(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").replace(/\(________\)/g, "").trim();
}

function skillFamily(name: string): string {
  const normalized = normalizeSkill(name);
  for (const family of ["knowledge", "craft", "perform", "profession"]) {
    if (normalized.startsWith(family)) return family;
  }
  return normalized.replace(/\s*\([^)]*\)\s*/g, "").trim();
}

function isClassSkill(charClass: string, skillName: string): boolean {
  const classes = charClass.split(/[\/,+]/).map((part) => part.trim().toLowerCase().replace(/\s+\d+$/, "")).filter(Boolean);
  const normalized = normalizeSkill(skillName);
  const family = skillFamily(skillName);
  return classes.some((className) => (CLASS_SKILLS[className] || []).some((entry) => {
    const listed = normalizeSkill(entry);
    return listed === normalized || listed === family || (listed === "knowledge" && family === "knowledge");
  }));
}

function parseLegacySkill(text: string): Dnd35SkillEntry {
  const rankMatch = text.match(/(\d+(?:\.5)?)\s*ranks?/i);
  const totalMatch = text.match(/;\s*([+-]\d+)/);
  const name = (rankMatch ? text.slice(0, rankMatch.index) : text.split(";")[0]).trim().replace(/[,:-]+$/, "");
  return { name, ranks: rankMatch ? Number(rankMatch[1]) : undefined, total: totalMatch ? Number(totalMatch[1]) : undefined };
}

function definitionFor(name: string): SkillDefinition | undefined {
  const normalized = normalizeSkill(name);
  const family = skillFamily(name);
  return CORE_SKILLS.find((definition) => normalizeSkill(definition.name) === normalized || skillFamily(definition.name) === family);
}

function raceSize(race: string): string | undefined {
  const normalized = race.toLowerCase();
  if (normalized.includes("halfling") || normalized.includes("gnome")) return "Small";
  if (["human", "elf", "dwarf", "half-elf", "half-orc"].some((entry) => normalized === entry || normalized.endsWith(` ${entry}`))) return "Medium";
  return undefined;
}

function spellLevelValue(record: Partial<Record<SpellLevelKey, number | string>> | undefined, level: number): number | string | undefined {
  return record?.[String(level) as SpellLevelKey];
}

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded border-2 border-stone-800 bg-[#f7f1df] shadow-sm ${className}`}>
      <div className="border-b-2 border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[#f7f1df]">{title}</div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function InfoBox({ label, value, className = "" }: { label: string; value: unknown; className?: string }) {
  return (
    <div className={`min-h-[50px] rounded border border-stone-500 bg-white/60 px-2 py-1 ${className}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="mt-1 min-h-5 text-sm font-semibold text-stone-950">{show(value)}</div>
    </div>
  );
}

function TableCell({ value, className = "" }: { value: unknown; className?: string }) {
  return <td className={`border border-stone-400 px-2 py-1.5 text-center ${className}`}>{show(value)}</td>;
}

export default function CharacterSheetPage() {
  const [, params] = useRoute("/character-sheet/:id");
  const campaignId = Number(params?.id);
  const { user } = useAuth();

  const campaignQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "character-sheet-campaign"],
    queryFn: () => api<Campaign>(`/api/campaigns/${campaignId}`),
    enabled: Number.isFinite(campaignId),
    staleTime: 30_000,
  });

  const characterQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "character-sheet-character"],
    queryFn: () => api<Character>(`/api/campaigns/${campaignId}/my-character`),
    enabled: Number.isFinite(campaignId),
    refetchInterval: 5000,
  });

  const character = characterQuery.data;

  const itemsQuery = useQuery({
    queryKey: ["/api/characters", character?.id, "character-sheet-items"],
    queryFn: () => api<Item[]>(`/api/characters/${character!.id}/items`),
    enabled: !!character?.id,
    refetchInterval: 5000,
  });

  const currenciesQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "character-sheet-currencies"],
    queryFn: () => api<CampaignCurrency[]>(`/api/campaigns/${campaignId}/currencies`),
    enabled: Number.isFinite(campaignId),
    refetchInterval: 5000,
  });

  const balancesQuery = useQuery({
    queryKey: ["/api/characters", character?.id, "character-sheet-balances"],
    queryFn: () => api<CurrencyBalance[]>(`/api/characters/${character!.id}/currencies`),
    enabled: !!character?.id,
    refetchInterval: 5000,
  });

  const parsed = useMemo(() => safeParse(character?.characterData || "{}"), [character?.characterData]);
  const sheet = parsed.dnd35Sheet;
  const rules = parsed.rulesProfile || {};
  const items = itemsQuery.data || [];
  const currencyDefs = currenciesQuery.data || [];
  const balances = balancesQuery.data || [];

  const scores = useMemo(() => {
    const values: Partial<Record<Dnd35Ability, number>> = {};
    for (const ability of ABILITIES) {
      const structured = sheet?.abilities?.[ability.key]?.score;
      const legacy = rules?.abilityScores?.[ability.key];
      if (typeof structured === "number") values[ability.key] = structured;
      else if (typeof legacy === "number") values[ability.key] = legacy;
    }
    return values;
  }, [sheet, rules]);

  const skills = useMemo<SkillRow[]>(() => {
    const explicit = new Map<string, Dnd35SkillEntry>();
    for (const skill of sheet?.skills || []) explicit.set(normalizeSkill(skill.name), skill);
    for (const raw of rules?.skills || []) {
      if (typeof raw !== "string") continue;
      const skill = parseLegacySkill(raw);
      if (!explicit.has(normalizeSkill(skill.name))) explicit.set(normalizeSkill(skill.name), skill);
    }

    const used = new Set<string>();
    const rows = CORE_SKILLS.map((definition): SkillRow => {
      const normalized = normalizeSkill(definition.name);
      const family = skillFamily(definition.name);
      let chosen = explicit.get(normalized);
      if (!chosen && ["knowledge", "craft", "perform", "profession"].includes(family)) {
        chosen = Array.from(explicit.values()).find((entry) => skillFamily(entry.name) === family);
      }
      if (chosen) used.add(normalizeSkill(chosen.name));
      const ability = chosen?.ability || definition.ability;
      return {
        name: chosen?.name || definition.name,
        ability,
        trainedOnly: chosen?.trainedOnly ?? definition.trainedOnly,
        acpApplies: definition.acpApplies,
        classSkill: chosen?.classSkill ?? (character ? isClassSkill(character.charClass, chosen?.name || definition.name) : false),
        ranks: chosen?.ranks,
        abilityModifier: chosen?.abilityModifier ?? (ability !== "none" ? modifier(scores[ability]) : undefined),
        miscModifier: chosen?.miscModifier,
        armorCheckPenalty: chosen?.armorCheckPenalty,
        total: chosen?.total,
        notes: chosen?.notes,
      };
    });

    for (const entry of explicit.values()) {
      if (used.has(normalizeSkill(entry.name))) continue;
      const definition = definitionFor(entry.name);
      const ability = entry.ability || definition?.ability || "none";
      rows.push({
        name: entry.name,
        ability,
        trainedOnly: entry.trainedOnly ?? definition?.trainedOnly,
        acpApplies: definition?.acpApplies,
        classSkill: entry.classSkill ?? (character ? isClassSkill(character.charClass, entry.name) : false),
        ranks: entry.ranks,
        abilityModifier: entry.abilityModifier ?? (ability !== "none" ? modifier(scores[ability]) : undefined),
        miscModifier: entry.miscModifier,
        armorCheckPenalty: entry.armorCheckPenalty,
        total: entry.total,
        notes: entry.notes,
      });
    }
    return rows;
  }, [sheet, rules, scores, character]);

  const feats = useMemo(() => sheet?.feats?.length ? sheet.feats : (rules?.feats || []).map((name: string) => ({ name, source: "Feat" })), [sheet, rules]);
  const specials = useMemo(() => {
    if (sheet?.specialAbilities?.length) return sheet.specialAbilities;
    return [
      ...(rules?.classFeatures || []).map((description: string) => ({ name: description.split(":")[0], source: "Class", description })),
      ...(rules?.racialTraits || []).map((description: string) => ({ name: description.split(":")[0], source: "Race", description })),
    ];
  }, [sheet, rules]);

  const spellcasting = useMemo<Dnd35SpellcastingBlock[]>(() => {
    if (sheet?.spellcasting?.length) return sheet.spellcasting;
    if (!rules?.spellcasting || !character) return [];
    const legacy = rules.spellcasting;
    return [{
      casterClass: character.charClass,
      casterLevel: character.level,
      castingAbility: legacy.ability,
      spells: [
        ...(legacy.cantrips || []).map((name: string) => ({ name, level: 0 })),
        ...(legacy.levelOneSpells || []).map((name: string) => ({ name, level: 1 })),
      ],
      notes: [legacy.notes, legacy.spellbook?.length ? `Spellbook: ${legacy.spellbook.join(", ")}` : null].filter(Boolean).join("\n"),
    }];
  }, [sheet, rules, character]);

  if (!Number.isFinite(campaignId)) return <div className="min-h-screen bg-stone-200 p-8 text-stone-950">Invalid campaign.</div>;
  if (characterQuery.isLoading) return <div className="min-h-screen bg-stone-200 p-8 text-stone-950">Loading character sheet...</div>;
  if (!character) return <div className="min-h-screen bg-stone-200 p-8 text-stone-950">No character is attached to this account in this campaign.</div>;

  const identity = sheet?.identity || {};
  const ac = sheet?.combat?.armorClass;
  const initiative = sheet?.combat?.initiative?.total ?? rules?.initiative;
  const dexMod = modifier(scores.dex);
  const initiativeMisc = sheet?.combat?.initiative?.miscModifier ?? (typeof initiative === "number" && typeof dexMod === "number" ? initiative - dexMod : undefined);
  const bab = sheet?.combat?.baseAttackBonus ?? rules?.baseAttackBonus;
  const saveTotals = rules?.saves || {};
  const classLevels = identity.classes?.length ? identity.classes.map((entry) => `${entry.className} ${entry.level}`).join(" / ") : `${character.charClass} ${character.level}`;

  const structuredWeapons = sheet?.combat?.weapons || [];
  const weaponItems = items.filter((item) => item.itemType.toLowerCase() === "weapon");
  const structuredArmor = sheet?.equipment?.armor || [];
  const armorItems = items.filter((item) => item.itemType.toLowerCase() === "armor");
  const gearItems = items.filter((item) => !["weapon", "armor"].includes(item.itemType.toLowerCase()));

  const wealth = sheet?.equipment?.wealth?.length ? sheet.equipment.wealth : balances.map((balance) => {
    const def = currencyDefs.find((entry) => entry.code === balance.currencyCode);
    return { code: balance.currencyCode, name: def?.name, symbol: def?.symbol, amount: balance.amount };
  });

  const saveRows = [
    { key: "fortitude" as const, label: "Fortitude", ability: "con" as Dnd35Ability, legacy: saveTotals.fort },
    { key: "reflex" as const, label: "Reflex", ability: "dex" as Dnd35Ability, legacy: saveTotals.ref },
    { key: "will" as const, label: "Will", ability: "wis" as Dnd35Ability, legacy: saveTotals.will },
  ];

  return (
    <div className="min-h-screen bg-[#d6cfbf] px-3 py-4 text-stone-950 print:bg-white print:p-0">
      <style>{`@media print {.sheet-controls{display:none!important}.sheet-page{max-width:none!important;box-shadow:none!important}section,tr{break-inside:avoid}table{break-inside:auto}}`}</style>

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
              <div className="mt-1 text-sm text-stone-600">D&D 3.5e · {campaignQuery.data?.name || "Campaign"} · read-only live sheet</div>
            </div>
            <div className="text-right text-xs text-stone-600"><div>Status: <strong>{character.status}</strong></div><div>Unrecorded values display as <strong>—</strong>.</div></div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <InfoBox label="Player" value={identity.playerName || user?.username} />
            <InfoBox label="Character Name" value={identity.characterName || character.name} className="md:col-span-2" />
            <InfoBox label="Class & Level" value={classLevels} className="md:col-span-2" />
            <InfoBox label="Race" value={identity.race || character.race} />
            <InfoBox label="Alignment" value={identity.alignment || rules?.alignment} />
            <InfoBox label="Deity" value={identity.deity} />
            <InfoBox label="Size" value={identity.size || raceSize(character.race)} />
            <InfoBox label="Age" value={identity.age} /><InfoBox label="Gender" value={identity.gender} />
            <InfoBox label="Height" value={identity.height} /><InfoBox label="Weight" value={identity.weight} />
            <InfoBox label="Eyes" value={identity.eyes} /><InfoBox label="Hair" value={identity.hair} /><InfoBox label="Skin" value={identity.skin} />
            <InfoBox label="Experience" value={identity.experiencePoints} /><InfoBox label="Next Level" value={identity.nextLevelExperience} />
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <Section title="Ability Scores">
              <div className="space-y-2">
                {ABILITIES.map((ability) => {
                  const score = scores[ability.key];
                  const temp = sheet?.abilities?.[ability.key]?.temporaryScore;
                  return <div key={ability.key} className="grid grid-cols-[70px_repeat(4,1fr)] gap-1 rounded border border-stone-400 bg-white/50 p-1.5"><div><div className="text-lg font-black">{ability.short}</div><div className="text-[9px] uppercase text-stone-500">{ability.label}</div></div><InfoBox label="Score" value={score} /><InfoBox label="Mod" value={signed(modifier(score))} /><InfoBox label="Temp" value={temp} /><InfoBox label="Temp Mod" value={temp == null ? undefined : signed(modifier(temp))} /></div>;
                })}
              </div>
            </Section>

            <Section title="Hit Points & Movement">
              <div className="grid grid-cols-2 gap-2">
                <InfoBox label="Current HP" value={sheet?.hitPoints?.current ?? character.hp} /><InfoBox label="Maximum HP" value={sheet?.hitPoints?.maximum ?? character.maxHp} />
                <InfoBox label="Temporary HP" value={sheet?.hitPoints?.temporary ?? character.tempHp} /><InfoBox label="Nonlethal Damage" value={sheet?.hitPoints?.nonlethalDamage} />
                <InfoBox label="Hit Dice" value={sheet?.hitPoints?.hitDice} /><InfoBox label="Land Speed" value={`${sheet?.movement?.land ?? character.speed} ft.`} />
                <InfoBox label="Fly" value={sheet?.movement?.fly == null ? undefined : `${sheet.movement.fly} ft.`} /><InfoBox label="Swim" value={sheet?.movement?.swim == null ? undefined : `${sheet.movement.swim} ft.`} />
                <InfoBox label="Climb" value={sheet?.movement?.climb == null ? undefined : `${sheet.movement.climb} ft.`} /><InfoBox label="Burrow" value={sheet?.movement?.burrow == null ? undefined : `${sheet.movement.burrow} ft.`} />
              </div>
            </Section>

            <Section title="Armor Class">
              <div className="grid grid-cols-3 gap-2"><InfoBox label="AC Total" value={ac?.total ?? rules?.armorClass} /><InfoBox label="Touch AC" value={ac?.touch} /><InfoBox label="Flat-Footed" value={ac?.flatFooted} /></div>
              <div className="mt-2 grid grid-cols-3 gap-2"><InfoBox label="Armor" value={ac?.armorBonus} /><InfoBox label="Shield" value={ac?.shieldBonus} /><InfoBox label="Dex" value={ac?.dexModifier ?? dexMod} /><InfoBox label="Size" value={ac?.sizeModifier} /><InfoBox label="Natural" value={ac?.naturalArmor} /><InfoBox label="Deflection" value={ac?.deflectionBonus} /><InfoBox label="Dodge" value={ac?.dodgeBonus} /><InfoBox label="Misc" value={ac?.miscModifier} /><InfoBox label="Temporary" value={ac?.temporaryModifier} /></div>
            </Section>

            <Section title="Initiative, BAB & Grapple">
              <div className="grid grid-cols-2 gap-2"><InfoBox label="Initiative" value={signed(initiative)} /><InfoBox label="Dex Modifier" value={signed(sheet?.combat?.initiative?.dexModifier ?? dexMod)} /><InfoBox label="Initiative Misc" value={signed(initiativeMisc)} /><InfoBox label="Base Attack Bonus" value={signed(bab)} /><InfoBox label="Grapple Total" value={signed(sheet?.combat?.grapple?.total)} /><InfoBox label="Attacks / Round" value={sheet?.combat?.attacksPerRound ?? character.attacksPerRound} /><InfoBox label="Spell Resistance" value={sheet?.combat?.spellResistance} /><InfoBox label="Damage Reduction" value={sheet?.combat?.damageReduction} /></div>
            </Section>
          </div>

          <div className="space-y-3">
            <Section title="Saving Throws">
              <div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr className="bg-stone-200 text-[10px] uppercase tracking-wider"><th className="border border-stone-400 px-2 py-1 text-left">Save</th><th className="border border-stone-400 px-2 py-1">Total</th><th className="border border-stone-400 px-2 py-1">Base</th><th className="border border-stone-400 px-2 py-1">Ability</th><th className="border border-stone-400 px-2 py-1">Magic</th><th className="border border-stone-400 px-2 py-1">Misc</th><th className="border border-stone-400 px-2 py-1">Temp</th></tr></thead><tbody>{saveRows.map((row) => { const data = sheet?.saves?.[row.key]; const abilityMod = modifier(scores[row.ability]); return <tr key={row.key}><td className="border border-stone-400 px-2 py-2 font-bold">{row.label} <span className="text-stone-500">({row.ability.toUpperCase()})</span></td><TableCell value={signed(data?.total ?? row.legacy)} /><TableCell value={signed(data?.baseSave)} /><TableCell value={signed(data?.abilityModifier ?? abilityMod)} /><TableCell value={signed(data?.magicModifier)} /><TableCell value={signed(data?.miscModifier)} /><TableCell value={signed(data?.temporaryModifier)} /></tr>; })}</tbody></table></div>
            </Section>

            <Section title="Weapons & Attacks">
              <div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr className="bg-stone-200 text-[10px] uppercase tracking-wider"><th className="border border-stone-400 px-2 py-1 text-left">Weapon</th><th className="border border-stone-400 px-2 py-1">Attack Bonus</th><th className="border border-stone-400 px-2 py-1">Damage</th><th className="border border-stone-400 px-2 py-1">Critical</th><th className="border border-stone-400 px-2 py-1">Range</th><th className="border border-stone-400 px-2 py-1">Type</th><th className="border border-stone-400 px-2 py-1 text-left">Notes</th></tr></thead><tbody>{structuredWeapons.length ? structuredWeapons.map((weapon, index) => <tr key={`${weapon.name}-${index}`}><td className="border border-stone-400 px-2 py-1.5 font-semibold">{weapon.name}</td><TableCell value={weapon.attackBonus} /><TableCell value={weapon.damage} /><TableCell value={weapon.critical} /><TableCell value={weapon.range} /><TableCell value={weapon.damageType} /><td className="border border-stone-400 px-2 py-1.5">{show(weapon.notes)}</td></tr>) : weaponItems.length ? weaponItems.map((item) => <tr key={item.id}><td className="border border-stone-400 px-2 py-1.5 font-semibold">{item.name}{item.equipped ? " · equipped" : ""}</td><TableCell value={undefined} /><TableCell value={undefined} /><TableCell value={undefined} /><TableCell value={undefined} /><TableCell value={undefined} /><td className="border border-stone-400 px-2 py-1.5">{show(item.description)}</td></tr>) : <tr><td className="border border-stone-400 px-2 py-3 text-center text-stone-500" colSpan={7}>No weapons recorded yet.</td></tr>}</tbody></table></div>
            </Section>

            <Section title="Skills">
              <div className="max-h-[720px] overflow-auto print:max-h-none print:overflow-visible"><table className="w-full border-collapse text-[11px]"><thead className="sticky top-0 bg-stone-200 print:static"><tr className="text-[9px] uppercase tracking-wider"><th className="border border-stone-400 px-1 py-1">CS</th><th className="border border-stone-400 px-2 py-1 text-left">Skill</th><th className="border border-stone-400 px-1 py-1">Ability</th><th className="border border-stone-400 px-1 py-1">Total</th><th className="border border-stone-400 px-1 py-1">Ranks</th><th className="border border-stone-400 px-1 py-1">Ability Mod</th><th className="border border-stone-400 px-1 py-1">Misc</th><th className="border border-stone-400 px-1 py-1">ACP</th></tr></thead><tbody>{skills.map((skill, index) => <tr key={`${skill.name}-${index}`} className={skill.ranks ? "bg-amber-50/70" : ""}><td className="border border-stone-400 px-1 py-1 text-center font-bold">{skill.classSkill ? "●" : ""}</td><td className="border border-stone-400 px-2 py-1 font-medium">{skill.name}{skill.trainedOnly ? <span className="ml-1 text-[9px] text-stone-500">†</span> : null}</td><td className="border border-stone-400 px-1 py-1 text-center uppercase">{skill.ability === "none" ? "—" : skill.ability}</td><td className="border border-stone-400 px-1 py-1 text-center font-bold">{signed(skill.total)}</td><td className="border border-stone-400 px-1 py-1 text-center">{show(skill.ranks)}</td><td className="border border-stone-400 px-1 py-1 text-center">{signed(skill.abilityModifier)}</td><td className="border border-stone-400 px-1 py-1 text-center">{signed(skill.miscModifier)}</td><td className="border border-stone-400 px-1 py-1 text-center">{skill.acpApplies ? signed(skill.armorCheckPenalty) : "—"}</td></tr>)}</tbody></table><div className="mt-2 text-[10px] text-stone-500">● class skill · † trained-only/special training · ACP = armor check penalty</div></div>
            </Section>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Section title="Feats">{feats.length ? <div className="grid gap-2 md:grid-cols-2">{feats.map((feat, index) => <div key={`${feat.name}-${index}`} className="rounded border border-stone-400 bg-white/50 p-2"><div className="font-bold">{feat.name}</div><div className="text-[10px] uppercase tracking-wider text-stone-500">{feat.source || "Feat"}</div>{feat.description && <div className="mt-1 text-xs whitespace-pre-wrap">{feat.description}</div>}</div>)}</div> : <div className="text-sm text-stone-500">No feats recorded yet.</div>}</Section>
          <Section title="Special Abilities, Class Features & Racial Traits">{specials.length ? <div className="grid gap-2 md:grid-cols-2">{specials.map((ability, index) => <div key={`${ability.name}-${index}`} className="rounded border border-stone-400 bg-white/50 p-2"><div className="font-bold">{ability.name}</div><div className="text-[10px] uppercase tracking-wider text-stone-500">{ability.source || "Special Ability"}</div>{ability.description && <div className="mt-1 text-xs whitespace-pre-wrap">{ability.description}</div>}</div>)}</div> : <div className="text-sm text-stone-500">No special abilities recorded yet.</div>}</Section>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Section title="Armor & Protective Gear">
            <div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr className="bg-stone-200 text-[9px] uppercase tracking-wider"><th className="border border-stone-400 px-2 py-1 text-left">Armor / Shield</th><th className="border border-stone-400 px-1 py-1">Bonus</th><th className="border border-stone-400 px-1 py-1">Max Dex</th><th className="border border-stone-400 px-1 py-1">ACP</th><th className="border border-stone-400 px-1 py-1">ASF</th><th className="border border-stone-400 px-1 py-1">Speed</th><th className="border border-stone-400 px-1 py-1">Weight</th></tr></thead><tbody>{structuredArmor.length ? structuredArmor.map((armor, index) => <tr key={`${armor.name}-${index}`}><td className="border border-stone-400 px-2 py-1.5 font-semibold">{armor.name}</td><TableCell value={armor.armorBonus} /><TableCell value={armor.maxDexBonus} /><TableCell value={armor.armorCheckPenalty} /><TableCell value={armor.arcaneSpellFailure} /><TableCell value={armor.speed} /><TableCell value={armor.weight} /></tr>) : armorItems.length ? armorItems.map((item) => <tr key={item.id}><td className="border border-stone-400 px-2 py-1.5 font-semibold">{item.name}{item.equipped ? " · equipped" : ""}</td><TableCell value={undefined} /><TableCell value={undefined} /><TableCell value={undefined} /><TableCell value={undefined} /><TableCell value={undefined} /><TableCell value={undefined} /></tr>) : <tr><td colSpan={7} className="border border-stone-400 px-2 py-3 text-center text-stone-500">No armor recorded yet.</td></tr>}</tbody></table></div>
          </Section>

          <Section title="Equipment, Wealth & Encumbrance">
            <div className="grid gap-3 md:grid-cols-2"><div><div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Gear</div><div className="space-y-1">{gearItems.length ? gearItems.map((item) => <div key={item.id} className="flex justify-between gap-2 rounded border border-stone-400 bg-white/50 px-2 py-1 text-xs"><div><strong>{item.name}</strong>{item.description ? <span className="text-stone-600"> · {item.description}</span> : null}</div><div className="shrink-0">×{item.quantity}</div></div>) : (sheet?.equipment?.gear || []).length ? sheet!.equipment!.gear!.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-2 rounded border border-stone-400 bg-white/50 px-2 py-1 text-xs"><div><strong>{item.name}</strong>{item.location ? <span className="text-stone-600"> · {item.location}</span> : null}</div><div className="shrink-0">×{item.quantity ?? 1}</div></div>) : <div className="text-xs text-stone-500">No gear recorded yet.</div>}</div></div><div><div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Wealth</div><div className="space-y-1">{wealth.length ? wealth.map((entry, index) => <div key={`${entry.code}-${index}`} className="flex justify-between rounded border border-stone-400 bg-white/50 px-2 py-1 text-xs"><span>{entry.name || entry.code}</span><strong>{entry.symbol ? `${entry.symbol}${entry.amount}` : `${entry.amount} ${entry.code}`}</strong></div>) : <div className="text-xs text-stone-500">No wealth recorded yet.</div>}</div></div></div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4"><InfoBox label="Current Weight" value={sheet?.equipment?.encumbrance?.currentWeight} /><InfoBox label="Light Load" value={sheet?.equipment?.encumbrance?.lightLoad} /><InfoBox label="Medium Load" value={sheet?.equipment?.encumbrance?.mediumLoad} /><InfoBox label="Heavy Load" value={sheet?.equipment?.encumbrance?.heavyLoad} /><InfoBox label="Lift Over Head" value={sheet?.equipment?.encumbrance?.liftOverHead} /><InfoBox label="Lift Off Ground" value={sheet?.equipment?.encumbrance?.liftOffGround} /><InfoBox label="Push / Drag" value={sheet?.equipment?.encumbrance?.pushOrDrag} /></div>
          </Section>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Section title="Proficiencies"><div className="space-y-2"><InfoBox label="Weapons" value={sheet?.proficiencies?.weapons?.join(", ")} /><InfoBox label="Armor" value={sheet?.proficiencies?.armor?.join(", ")} /><InfoBox label="Shields" value={sheet?.proficiencies?.shields?.join(", ")} /><InfoBox label="Other" value={sheet?.proficiencies?.other?.join(", ")} /></div></Section>
          <Section title="Languages">{sheet?.languages?.length ? <div className="flex flex-wrap gap-2">{sheet.languages.map((language) => <span key={language} className="rounded border border-stone-400 bg-white/60 px-2 py-1 text-sm font-semibold">{language}</span>)}</div> : <div className="text-sm text-stone-500">No languages recorded yet.</div>}</Section>
          <Section title="Character Notes"><div className="space-y-2 text-xs"><div><strong>Traits:</strong><div className="mt-1 whitespace-pre-wrap text-stone-700">{sheet?.notes?.traits || character.traits || "—"}</div></div><div><strong>Allies & Contacts:</strong><div className="mt-1 whitespace-pre-wrap text-stone-700">{sheet?.notes?.alliesAndContacts || "—"}</div></div><div><strong>Enemies:</strong><div className="mt-1 whitespace-pre-wrap text-stone-700">{sheet?.notes?.enemies || "—"}</div></div></div></Section>
        </div>

        <Section title="Spellcasting">
          {spellcasting.length ? <div className="space-y-4">{spellcasting.map((block, blockIndex) => { const castingMod = block.castingAbility ? modifier(scores[block.castingAbility]) : undefined; return <div key={`${block.casterClass}-${blockIndex}`} className="rounded border border-stone-400 bg-white/40 p-3"><div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6"><InfoBox label="Caster Class" value={block.casterClass} /><InfoBox label="Caster Level" value={block.casterLevel} /><InfoBox label="Casting Ability" value={block.castingAbility?.toUpperCase()} /><InfoBox label="Ability Modifier" value={signed(castingMod)} /><InfoBox label="Domains" value={block.domains?.join(", ")} /><InfoBox label="Specialization" value={block.specialization} /></div><div className="mt-3 overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr className="bg-stone-200 text-[9px] uppercase tracking-wider"><th className="border border-stone-400 px-1 py-1">Spell Level</th>{Array.from({ length: 10 }, (_, level) => <th key={level} className="border border-stone-400 px-1 py-1">{level}</th>)}</tr></thead><tbody><tr><td className="border border-stone-400 px-2 py-1 font-semibold">Save DC</td>{Array.from({ length: 10 }, (_, level) => <TableCell key={level} value={spellLevelValue(block.spellSaveDcByLevel, level) ?? (castingMod === undefined ? undefined : 10 + level + castingMod)} />)}</tr><tr><td className="border border-stone-400 px-2 py-1 font-semibold">Spells / Day</td>{Array.from({ length: 10 }, (_, level) => <TableCell key={level} value={spellLevelValue(block.spellsPerDay, level)} />)}</tr><tr><td className="border border-stone-400 px-2 py-1 font-semibold">Bonus Spells</td>{Array.from({ length: 10 }, (_, level) => <TableCell key={level} value={spellLevelValue(block.bonusSpells, level)} />)}</tr></tbody></table></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{(block.spells || []).length ? block.spells!.map((spell, index) => <div key={`${spell.level}-${spell.name}-${index}`} className="rounded border border-stone-400 bg-white/60 p-2 text-xs"><div className="flex justify-between gap-2"><strong>{spell.name}</strong><span>Lv {spell.level}</span></div><div className="mt-1 text-stone-600">{[spell.school, spell.known ? "known" : null, spell.prepared ? `prepared ×${spell.prepared}` : null].filter(Boolean).join(" · ") || "Recorded spell"}</div>{spell.notes && <div className="mt-1 whitespace-pre-wrap">{spell.notes}</div>}</div>) : <div className="text-sm text-stone-500">No spell list recorded yet.</div>}</div>{(block.notes || block.prohibitedSchools?.length) && <div className="mt-3 rounded border border-stone-400 bg-white/50 p-2 text-xs whitespace-pre-wrap">{[block.prohibitedSchools?.length ? `Prohibited schools: ${block.prohibitedSchools.join(", ")}` : null, block.notes].filter(Boolean).join("\n")}</div>}</div>; })}</div> : <div className="text-sm text-stone-500">This character has no spellcasting data recorded.</div>}
        </Section>

        <Section title="Backstory & Campaign Notes"><div className="grid gap-3 lg:grid-cols-2"><div><div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Backstory</div><div className="min-h-32 rounded border border-stone-400 bg-white/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">{sheet?.notes?.backstory || character.backstory || "—"}</div></div><div><div className="mb-1 text-[10px] font-black uppercase tracking-wider text-stone-500">Campaign Notes</div><div className="min-h-32 rounded border border-stone-400 bg-white/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">{sheet?.notes?.campaignNotes || "—"}</div></div></div></Section>
      </main>
    </div>
  );
}
