export type Dnd35SkillAbility = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type Dnd35SkillDefinition = {
  id: string;
  name: string;
  ability: Dnd35SkillAbility | null;
  trainedOnly: boolean;
  armorCheckPenalty: boolean;
  armorCheckPenaltyMultiplier?: number;
  family?: "craft" | "knowledge" | "perform" | "profession";
};

const skill = (
  id: string,
  name: string,
  ability: Dnd35SkillAbility | null,
  trainedOnly = false,
  armorCheckPenalty = false,
  extras: Partial<Dnd35SkillDefinition> = {},
): Dnd35SkillDefinition => ({ id, name, ability, trainedOnly, armorCheckPenalty, ...extras });

/**
 * Core Revised 3.5 skills. Psionic and special-template skills live outside
 * this base list so an ordinary 3.5 character sheet does not silently gain
 * variant-system skills.
 */
export const DND35_CORE_SKILLS: Dnd35SkillDefinition[] = [
  skill("appraise", "Appraise", "int"),
  skill("balance", "Balance", "dex", false, true),
  skill("bluff", "Bluff", "cha"),
  skill("climb", "Climb", "str", false, true),
  skill("concentration", "Concentration", "con"),
  skill("craft", "Craft", "int", false, false, { family: "craft" }),
  skill("decipher-script", "Decipher Script", "int", true),
  skill("diplomacy", "Diplomacy", "cha"),
  skill("disable-device", "Disable Device", "int", true),
  skill("disguise", "Disguise", "cha"),
  skill("escape-artist", "Escape Artist", "dex", false, true),
  skill("forgery", "Forgery", "int"),
  skill("gather-information", "Gather Information", "cha"),
  skill("handle-animal", "Handle Animal", "cha", true),
  skill("heal", "Heal", "wis"),
  skill("hide", "Hide", "dex", false, true),
  skill("intimidate", "Intimidate", "cha"),
  skill("jump", "Jump", "str", false, true),
  skill("knowledge-arcana", "Knowledge (arcana)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-architecture-and-engineering", "Knowledge (architecture and engineering)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-dungeoneering", "Knowledge (dungeoneering)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-geography", "Knowledge (geography)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-history", "Knowledge (history)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-local", "Knowledge (local)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-nature", "Knowledge (nature)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-nobility-and-royalty", "Knowledge (nobility and royalty)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-religion", "Knowledge (religion)", "int", true, false, { family: "knowledge" }),
  skill("knowledge-the-planes", "Knowledge (the planes)", "int", true, false, { family: "knowledge" }),
  skill("listen", "Listen", "wis"),
  skill("move-silently", "Move Silently", "dex", false, true),
  skill("open-lock", "Open Lock", "dex", true),
  skill("perform", "Perform", "cha", false, false, { family: "perform" }),
  skill("profession", "Profession", "wis", true, false, { family: "profession" }),
  skill("ride", "Ride", "dex"),
  skill("search", "Search", "int"),
  skill("sense-motive", "Sense Motive", "wis"),
  skill("sleight-of-hand", "Sleight of Hand", "dex", true, true),
  skill("speak-language", "Speak Language", null, true),
  skill("spellcraft", "Spellcraft", "int", true),
  skill("spot", "Spot", "wis"),
  skill("survival", "Survival", "wis"),
  skill("swim", "Swim", "str", false, true, { armorCheckPenaltyMultiplier: 2 }),
  skill("tumble", "Tumble", "dex", true, true),
  skill("use-magic-device", "Use Magic Device", "cha", true),
  skill("use-rope", "Use Rope", "dex"),
];

const normalize = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const byId = new Map(DND35_CORE_SKILLS.map((entry) => [entry.id, entry]));
const byName = new Map(DND35_CORE_SKILLS.map((entry) => [normalize(entry.name), entry]));

export function getDnd35Skill(idOrName: string): Dnd35SkillDefinition | undefined {
  const normalized = normalize(idOrName);
  const exact = byId.get(normalized) ?? byName.get(normalized);
  if (exact) return exact;
  if (normalized.startsWith("craft-")) return byId.get("craft");
  if (normalized.startsWith("perform-")) return byId.get("perform");
  if (normalized.startsWith("profession-")) return byId.get("profession");
  return undefined;
}

export function dnd35RecordedSkillRanks(characterData: string, idOrName: string): number {
  const definition = getDnd35Skill(idOrName);
  const requested = normalize(idOrName);
  try {
    const parsed = JSON.parse(characterData || "{}");
    const rows = Array.isArray(parsed?.dnd35Sheet?.skills) ? parsed.dnd35Sheet.skills : [];
    const matching = rows.find((row: any) => {
      const rowName = normalize(String(row?.name ?? row?.skill ?? row?.id ?? ""));
      if (rowName === requested || rowName === definition?.id || rowName === normalize(definition?.name ?? "")) return true;
      if (definition?.family === "craft" && rowName.startsWith("craft-")) return requested === "craft" || rowName === requested;
      if (definition?.family === "perform" && rowName.startsWith("perform-")) return requested === "perform" || rowName === requested;
      if (definition?.family === "profession" && rowName.startsWith("profession-")) return requested === "profession" || rowName === requested;
      return false;
    });
    const ranks = Number(matching?.ranks ?? 0);
    return Number.isFinite(ranks) && ranks > 0 ? ranks : 0;
  } catch {
    return 0;
  }
}

export function dnd35MaximumClassSkillRanks(characterLevel: number): number {
  return Math.max(0, characterLevel) + 3;
}

export function dnd35MaximumCrossClassSkillRanks(characterLevel: number): number {
  return dnd35MaximumClassSkillRanks(characterLevel) / 2;
}
