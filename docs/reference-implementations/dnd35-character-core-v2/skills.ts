// Reference implementation only.

import type { Dnd35Ability } from "./domain";

export type Dnd35SkillDefinition = {
  id: string;
  displayName: string;
  ability: Dnd35Ability | null;
  trainedOnly: boolean;
  armorCheckPenaltyMultiplier: 0 | 1 | 2;
  family?: "craft" | "knowledge" | "perform" | "profession";
};

const s = (
  id: string,
  displayName: string,
  ability: Dnd35Ability | null,
  trainedOnly = false,
  armorCheckPenaltyMultiplier: 0 | 1 | 2 = 0,
  family?: Dnd35SkillDefinition["family"],
): Dnd35SkillDefinition => ({ id, displayName, ability, trainedOnly, armorCheckPenaltyMultiplier, family });

/** Core PHB/SRD skills. Open-ended families use canonical prefixes such as knowledge:arcana. */
export const CORE_SKILLS: Dnd35SkillDefinition[] = [
  s("appraise", "Appraise", "int"),
  s("balance", "Balance", "dex", false, 1),
  s("bluff", "Bluff", "cha"),
  s("climb", "Climb", "str", false, 1),
  s("concentration", "Concentration", "con"),
  s("craft", "Craft", "int", false, 0, "craft"),
  s("decipher-script", "Decipher Script", "int", true),
  s("diplomacy", "Diplomacy", "cha"),
  s("disable-device", "Disable Device", "int", true),
  s("disguise", "Disguise", "cha"),
  s("escape-artist", "Escape Artist", "dex", false, 1),
  s("forgery", "Forgery", "int"),
  s("gather-information", "Gather Information", "cha"),
  s("handle-animal", "Handle Animal", "cha", true),
  s("heal", "Heal", "wis"),
  s("hide", "Hide", "dex", false, 1),
  s("intimidate", "Intimidate", "cha"),
  s("jump", "Jump", "str", false, 1),
  s("knowledge:arcana", "Knowledge (arcana)", "int", true, 0, "knowledge"),
  s("knowledge:architecture-engineering", "Knowledge (architecture and engineering)", "int", true, 0, "knowledge"),
  s("knowledge:dungeoneering", "Knowledge (dungeoneering)", "int", true, 0, "knowledge"),
  s("knowledge:geography", "Knowledge (geography)", "int", true, 0, "knowledge"),
  s("knowledge:history", "Knowledge (history)", "int", true, 0, "knowledge"),
  s("knowledge:local", "Knowledge (local)", "int", true, 0, "knowledge"),
  s("knowledge:nature", "Knowledge (nature)", "int", true, 0, "knowledge"),
  s("knowledge:nobility-royalty", "Knowledge (nobility and royalty)", "int", true, 0, "knowledge"),
  s("knowledge:religion", "Knowledge (religion)", "int", true, 0, "knowledge"),
  s("knowledge:planes", "Knowledge (the planes)", "int", true, 0, "knowledge"),
  s("listen", "Listen", "wis"),
  s("move-silently", "Move Silently", "dex", false, 1),
  s("open-lock", "Open Lock", "dex", true),
  s("perform", "Perform", "cha", false, 0, "perform"),
  s("profession", "Profession", "wis", true, 0, "profession"),
  s("ride", "Ride", "dex"),
  s("search", "Search", "int"),
  s("sense-motive", "Sense Motive", "wis"),
  s("sleight-of-hand", "Sleight of Hand", "dex", true, 1),
  s("speak-language", "Speak Language", null, true),
  s("spellcraft", "Spellcraft", "int", true),
  s("spot", "Spot", "wis"),
  s("survival", "Survival", "wis"),
  s("swim", "Swim", "str", false, 2),
  s("tumble", "Tumble", "dex", true, 1),
  s("use-magic-device", "Use Magic Device", "cha", true),
  s("use-rope", "Use Rope", "dex"),
];

const BY_ID = new Map(CORE_SKILLS.map((skill) => [skill.id, skill]));

export function normalizeSkillId(skillId: string): string {
  const id = skillId.trim().toLowerCase();
  if (id.startsWith("craft:")) return id;
  if (id.startsWith("knowledge:")) return id;
  if (id.startsWith("perform:")) return id;
  if (id.startsWith("profession:")) return id;
  return id.replace(/\s+/g, "-");
}

export function getSkillDefinition(skillId: string): Dnd35SkillDefinition | undefined {
  const normalized = normalizeSkillId(skillId);
  const exact = BY_ID.get(normalized);
  if (exact) return exact;

  for (const family of ["craft", "knowledge", "perform", "profession"] as const) {
    if (normalized.startsWith(`${family}:`)) {
      return BY_ID.get(family === "knowledge" ? normalized : family) ?? CORE_SKILLS.find((skill) => skill.family === family);
    }
  }

  return undefined;
}

export function isClassSkill(classSkills: string[], skillId: string): boolean {
  const normalized = normalizeSkillId(skillId);
  if (classSkills.includes(normalized)) return true;

  const [family] = normalized.split(":");
  return classSkills.includes(family);
}
