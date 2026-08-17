// Reference implementation only. Core PHB/SRD base-class metadata.

import type { CoreClassId, Dnd35Ability, Dnd35Save } from "./domain";

export type BabProgression = "good" | "medium" | "poor";
export type SaveProgression = "good" | "poor";

export type Dnd35SpellcastingProfile = {
  kind: "prepared" | "spontaneous";
  tradition: "arcane" | "divine";
  ability: Dnd35Ability;
  startsAtClassLevel: number;
  casterLevel: "full" | "half_class_level";
  usesSpellbook?: boolean;
  hasDomains?: boolean;
};

export type Dnd35ClassFeatureGrant = {
  level: number;
  featureId: string;
  label: string;
  choiceRequired?: boolean;
  choiceType?: "feat" | "favored_enemy" | "combat_style" | "special_ability" | "companion" | "domain" | "other";
  repeatable?: boolean;
};

export type Dnd35ClassDefinition = {
  id: CoreClassId;
  displayName: string;
  hitDie: 4 | 6 | 8 | 10 | 12;
  bab: BabProgression;
  saves: Record<Dnd35Save, SaveProgression>;
  skillPointsPerLevel: number;
  classSkills: string[];
  spellcasting?: Dnd35SpellcastingProfile;
  features: Dnd35ClassFeatureGrant[];
  /** Machine-readable baseline restrictions. Setting/deity/source packs may add more. */
  restrictions?: Array<
    | { type: "alignment"; allowed: string[] }
    | { type: "alignment"; forbidden: string[] }
    | { type: "code"; id: string }
  >;
};

const def = (value: Dnd35ClassDefinition) => value;
const f = (
  level: number,
  featureId: string,
  label: string,
  choiceRequired = false,
  choiceType?: Dnd35ClassFeatureGrant["choiceType"],
): Dnd35ClassFeatureGrant => ({ level, featureId, label, choiceRequired, choiceType });
const knowledge = (...names: string[]) => names.map((name) => `knowledge:${name}`);

export const CORE_CLASSES: Record<CoreClassId, Dnd35ClassDefinition> = {
  barbarian: def({
    id: "barbarian",
    displayName: "Barbarian",
    hitDie: 12,
    bab: "good",
    saves: { fortitude: "good", reflex: "poor", will: "poor" },
    skillPointsPerLevel: 4,
    classSkills: ["climb", "craft", "handle-animal", "intimidate", "jump", "listen", "ride", "survival", "swim"],
    restrictions: [{ type: "alignment", forbidden: ["lawful good", "lawful neutral", "lawful evil"] }],
    features: [
      f(1, "barbarian:fast-movement", "Fast Movement"),
      f(1, "barbarian:illiteracy", "Illiteracy"),
      f(1, "barbarian:rage-1", "Rage 1/day"),
      f(2, "barbarian:uncanny-dodge", "Uncanny Dodge"),
      f(3, "barbarian:trap-sense-1", "Trap Sense +1"),
      f(4, "barbarian:rage-2", "Rage 2/day"),
      f(5, "barbarian:improved-uncanny-dodge", "Improved Uncanny Dodge"),
      f(6, "barbarian:trap-sense-2", "Trap Sense +2"),
      f(7, "barbarian:damage-reduction-1", "Damage Reduction 1/-"),
      f(8, "barbarian:rage-3", "Rage 3/day"),
      f(9, "barbarian:trap-sense-3", "Trap Sense +3"),
      f(10, "barbarian:damage-reduction-2", "Damage Reduction 2/-"),
      f(11, "barbarian:greater-rage", "Greater Rage"),
      f(12, "barbarian:rage-4", "Rage 4/day"),
      f(12, "barbarian:trap-sense-4", "Trap Sense +4"),
      f(13, "barbarian:damage-reduction-3", "Damage Reduction 3/-"),
      f(14, "barbarian:indomitable-will", "Indomitable Will"),
      f(15, "barbarian:trap-sense-5", "Trap Sense +5"),
      f(16, "barbarian:damage-reduction-4", "Damage Reduction 4/-"),
      f(16, "barbarian:rage-5", "Rage 5/day"),
      f(17, "barbarian:tireless-rage", "Tireless Rage"),
      f(18, "barbarian:trap-sense-6", "Trap Sense +6"),
      f(19, "barbarian:damage-reduction-5", "Damage Reduction 5/-"),
      f(20, "barbarian:mighty-rage", "Mighty Rage"),
      f(20, "barbarian:rage-6", "Rage 6/day"),
    ],
  }),

  bard: def({
    id: "bard",
    displayName: "Bard",
    hitDie: 6,
    bab: "medium",
    saves: { fortitude: "poor", reflex: "good", will: "good" },
    skillPointsPerLevel: 6,
    classSkills: [
      "appraise", "balance", "bluff", "climb", "concentration", "craft", "decipher-script", "diplomacy",
      "disguise", "escape-artist", "gather-information", "hide", "jump", "listen", "move-silently", "perform",
      "profession", "sense-motive", "sleight-of-hand", "speak-language", "spellcraft", "swim", "tumble", "use-magic-device",
      ...knowledge("arcana", "architecture-engineering", "dungeoneering", "geography", "history", "local", "nature", "nobility-royalty", "religion", "planes"),
    ],
    spellcasting: { kind: "spontaneous", tradition: "arcane", ability: "cha", startsAtClassLevel: 1, casterLevel: "full" },
    restrictions: [{ type: "alignment", forbidden: ["lawful good", "lawful neutral", "lawful evil"] }],
    features: [
      f(1, "bard:bardic-knowledge", "Bardic Knowledge"),
      f(1, "bard:bardic-music", "Bardic Music"),
      f(1, "bard:countersong", "Countersong"),
      f(1, "bard:fascinate", "Fascinate"),
      f(1, "bard:inspire-courage-1", "Inspire Courage +1"),
      f(3, "bard:inspire-competence", "Inspire Competence"),
      f(6, "bard:suggestion", "Suggestion"),
      f(8, "bard:inspire-courage-2", "Inspire Courage +2"),
      f(9, "bard:inspire-greatness", "Inspire Greatness"),
      f(12, "bard:song-of-freedom", "Song of Freedom"),
      f(14, "bard:inspire-courage-3", "Inspire Courage +3"),
      f(15, "bard:inspire-heroics", "Inspire Heroics"),
      f(18, "bard:mass-suggestion", "Mass Suggestion"),
      f(20, "bard:inspire-courage-4", "Inspire Courage +4"),
    ],
  }),

  cleric: def({
    id: "cleric",
    displayName: "Cleric",
    hitDie: 8,
    bab: "medium",
    saves: { fortitude: "good", reflex: "poor", will: "good" },
    skillPointsPerLevel: 2,
    classSkills: ["concentration", "craft", "diplomacy", "heal", "profession", "spellcraft", ...knowledge("arcana", "history", "religion", "planes")],
    spellcasting: { kind: "prepared", tradition: "divine", ability: "wis", startsAtClassLevel: 1, casterLevel: "full", hasDomains: true },
    features: [
      f(1, "cleric:domains", "Two Domains", true, "domain"),
      f(1, "cleric:turn-rebuke-undead", "Turn or Rebuke Undead", true, "other"),
      f(1, "cleric:spontaneous-casting", "Spontaneous Cure/Inflict Conversion", true, "other"),
    ],
  }),

  druid: def({
    id: "druid",
    displayName: "Druid",
    hitDie: 8,
    bab: "medium",
    saves: { fortitude: "good", reflex: "poor", will: "good" },
    skillPointsPerLevel: 4,
    classSkills: ["concentration", "craft", "diplomacy", "handle-animal", "heal", "knowledge:nature", "listen", "profession", "ride", "spellcraft", "spot", "survival", "swim"],
    spellcasting: { kind: "prepared", tradition: "divine", ability: "wis", startsAtClassLevel: 1, casterLevel: "full" },
    restrictions: [{ type: "alignment", allowed: ["neutral good", "lawful neutral", "true neutral", "neutral", "chaotic neutral", "neutral evil"] }],
    features: [
      f(1, "druid:animal-companion", "Animal Companion", true, "companion"),
      f(1, "druid:nature-sense", "Nature Sense"),
      f(1, "druid:wild-empathy", "Wild Empathy"),
      f(2, "druid:woodland-stride", "Woodland Stride"),
      f(3, "druid:trackless-step", "Trackless Step"),
      f(4, "druid:resist-natures-lure", "Resist Nature's Lure"),
      f(5, "druid:wild-shape-1", "Wild Shape 1/day"),
      f(6, "druid:wild-shape-2", "Wild Shape 2/day"),
      f(7, "druid:wild-shape-3", "Wild Shape 3/day"),
      f(8, "druid:wild-shape-large", "Wild Shape (Large)"),
      f(9, "druid:venom-immunity", "Venom Immunity"),
      f(10, "druid:wild-shape-4", "Wild Shape 4/day"),
      f(11, "druid:wild-shape-tiny", "Wild Shape (Tiny)"),
      f(12, "druid:wild-shape-plant", "Wild Shape (Plant)"),
      f(13, "druid:thousand-faces", "A Thousand Faces"),
      f(14, "druid:wild-shape-5", "Wild Shape 5/day"),
      f(15, "druid:timeless-body", "Timeless Body"),
      f(15, "druid:wild-shape-huge", "Wild Shape (Huge)"),
      f(16, "druid:elemental-shape-1", "Elemental Wild Shape 1/day"),
      f(18, "druid:wild-shape-6", "Wild Shape 6/day"),
      f(18, "druid:elemental-shape-2", "Elemental Wild Shape 2/day"),
      f(20, "druid:elemental-shape-3", "Elemental Wild Shape 3/day"),
      f(20, "druid:elemental-shape-huge", "Elemental Wild Shape (Huge)"),
    ],
  }),

  fighter: def({
    id: "fighter",
    displayName: "Fighter",
    hitDie: 10,
    bab: "good",
    saves: { fortitude: "good", reflex: "poor", will: "poor" },
    skillPointsPerLevel: 2,
    classSkills: ["climb", "craft", "handle-animal", "intimidate", "jump", "ride", "swim"],
    features: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((level) => ({
      level,
      featureId: `fighter:bonus-feat:${level}`,
      label: "Fighter Bonus Feat",
      choiceRequired: true,
      choiceType: "feat" as const,
      repeatable: true,
    })),
  }),

  monk: def({
    id: "monk",
    displayName: "Monk",
    hitDie: 8,
    bab: "medium",
    saves: { fortitude: "good", reflex: "good", will: "good" },
    skillPointsPerLevel: 4,
    classSkills: ["balance", "climb", "concentration", "craft", "diplomacy", "escape-artist", "hide", "jump", "knowledge:arcana", "knowledge:religion", "listen", "move-silently", "perform", "profession", "sense-motive", "spot", "swim", "tumble"],
    restrictions: [{ type: "alignment", allowed: ["lawful good", "lawful neutral", "lawful evil"] }],
    features: [
      f(1, "monk:bonus-feat-1", "Monk Bonus Feat", true, "feat"),
      f(1, "monk:flurry", "Flurry of Blows"),
      f(1, "monk:unarmed-strike", "Unarmed Strike"),
      f(2, "monk:bonus-feat-2", "Monk Bonus Feat", true, "feat"),
      f(2, "monk:evasion", "Evasion"),
      f(3, "monk:still-mind", "Still Mind"),
      f(3, "monk:fast-movement-10", "Fast Movement +10 ft."),
      f(4, "monk:ki-strike-magic", "Ki Strike (magic)"),
      f(4, "monk:slow-fall-20", "Slow Fall 20 ft."),
      f(5, "monk:purity-body", "Purity of Body"),
      f(6, "monk:bonus-feat-6", "Monk Bonus Feat", true, "feat"),
      f(6, "monk:fast-movement-20", "Fast Movement +20 ft."),
      f(6, "monk:slow-fall-30", "Slow Fall 30 ft."),
      f(7, "monk:wholeness-body", "Wholeness of Body"),
      f(8, "monk:slow-fall-40", "Slow Fall 40 ft."),
      f(9, "monk:improved-evasion", "Improved Evasion"),
      f(9, "monk:fast-movement-30", "Fast Movement +30 ft."),
      f(10, "monk:ki-strike-lawful", "Ki Strike (lawful)"),
      f(10, "monk:slow-fall-50", "Slow Fall 50 ft."),
      f(11, "monk:diamond-body", "Diamond Body"),
      f(11, "monk:greater-flurry", "Greater Flurry"),
      f(12, "monk:abundant-step", "Abundant Step"),
      f(12, "monk:fast-movement-40", "Fast Movement +40 ft."),
      f(12, "monk:slow-fall-60", "Slow Fall 60 ft."),
      f(13, "monk:diamond-soul", "Diamond Soul"),
      f(14, "monk:slow-fall-70", "Slow Fall 70 ft."),
      f(15, "monk:quivering-palm", "Quivering Palm"),
      f(15, "monk:fast-movement-50", "Fast Movement +50 ft."),
      f(16, "monk:ki-strike-adamantine", "Ki Strike (adamantine)"),
      f(16, "monk:slow-fall-80", "Slow Fall 80 ft."),
      f(17, "monk:timeless-body", "Timeless Body"),
      f(17, "monk:tongue-sun-moon", "Tongue of the Sun and Moon"),
      f(18, "monk:fast-movement-60", "Fast Movement +60 ft."),
      f(18, "monk:slow-fall-90", "Slow Fall 90 ft."),
      f(19, "monk:empty-body", "Empty Body"),
      f(20, "monk:perfect-self", "Perfect Self"),
      f(20, "monk:slow-fall-any", "Slow Fall (any distance)"),
    ],
  }),

  paladin: def({
    id: "paladin",
    displayName: "Paladin",
    hitDie: 10,
    bab: "good",
    saves: { fortitude: "good", reflex: "poor", will: "poor" },
    skillPointsPerLevel: 2,
    classSkills: ["concentration", "craft", "diplomacy", "handle-animal", "heal", "knowledge:nobility-royalty", "knowledge:religion", "profession", "ride", "sense-motive"],
    spellcasting: { kind: "prepared", tradition: "divine", ability: "wis", startsAtClassLevel: 4, casterLevel: "half_class_level" },
    restrictions: [
      { type: "alignment", allowed: ["lawful good"] },
      { type: "code", id: "paladin:code-of-conduct" },
    ],
    features: [
      f(1, "paladin:aura-good", "Aura of Good"),
      f(1, "paladin:detect-evil", "Detect Evil"),
      f(1, "paladin:smite-evil-1", "Smite Evil 1/day"),
      f(2, "paladin:divine-grace", "Divine Grace"),
      f(2, "paladin:lay-on-hands", "Lay on Hands"),
      f(3, "paladin:aura-courage", "Aura of Courage"),
      f(3, "paladin:divine-health", "Divine Health"),
      f(4, "paladin:turn-undead", "Turn Undead"),
      f(5, "paladin:smite-evil-2", "Smite Evil 2/day"),
      f(5, "paladin:special-mount", "Special Mount", true, "companion"),
      f(6, "paladin:remove-disease-1", "Remove Disease 1/week"),
      f(9, "paladin:remove-disease-2", "Remove Disease 2/week"),
      f(10, "paladin:smite-evil-3", "Smite Evil 3/day"),
      f(12, "paladin:remove-disease-3", "Remove Disease 3/week"),
      f(15, "paladin:remove-disease-4", "Remove Disease 4/week"),
      f(15, "paladin:smite-evil-4", "Smite Evil 4/day"),
      f(18, "paladin:remove-disease-5", "Remove Disease 5/week"),
      f(20, "paladin:smite-evil-5", "Smite Evil 5/day"),
    ],
  }),

  ranger: def({
    id: "ranger",
    displayName: "Ranger",
    hitDie: 8,
    bab: "good",
    saves: { fortitude: "good", reflex: "good", will: "poor" },
    skillPointsPerLevel: 6,
    classSkills: ["climb", "concentration", "craft", "handle-animal", "heal", "hide", "jump", "knowledge:dungeoneering", "knowledge:geography", "knowledge:nature", "listen", "move-silently", "profession", "ride", "search", "spot", "survival", "swim", "use-rope"],
    spellcasting: { kind: "prepared", tradition: "divine", ability: "wis", startsAtClassLevel: 4, casterLevel: "half_class_level" },
    features: [
      f(1, "ranger:favored-enemy-1", "Favored Enemy", true, "favored_enemy"),
      f(1, "ranger:track", "Track"),
      f(1, "ranger:wild-empathy", "Wild Empathy"),
      f(2, "ranger:combat-style", "Combat Style", true, "combat_style"),
      f(3, "ranger:endurance", "Endurance"),
      f(4, "ranger:animal-companion", "Animal Companion", true, "companion"),
      f(5, "ranger:favored-enemy-2", "Favored Enemy", true, "favored_enemy"),
      f(6, "ranger:improved-combat-style", "Improved Combat Style"),
      f(7, "ranger:woodland-stride", "Woodland Stride"),
      f(8, "ranger:swift-tracker", "Swift Tracker"),
      f(9, "ranger:evasion", "Evasion"),
      f(10, "ranger:favored-enemy-3", "Favored Enemy", true, "favored_enemy"),
      f(11, "ranger:combat-style-mastery", "Combat Style Mastery"),
      f(13, "ranger:camouflage", "Camouflage"),
      f(15, "ranger:favored-enemy-4", "Favored Enemy", true, "favored_enemy"),
      f(17, "ranger:hide-in-plain-sight", "Hide in Plain Sight"),
      f(20, "ranger:favored-enemy-5", "Favored Enemy", true, "favored_enemy"),
    ],
  }),

  rogue: def({
    id: "rogue",
    displayName: "Rogue",
    hitDie: 6,
    bab: "medium",
    saves: { fortitude: "poor", reflex: "good", will: "poor" },
    skillPointsPerLevel: 8,
    classSkills: [
      "appraise", "balance", "bluff", "climb", "craft", "decipher-script", "diplomacy", "disable-device", "disguise",
      "escape-artist", "forgery", "gather-information", "hide", "intimidate", "jump", "knowledge:local", "listen", "move-silently",
      "open-lock", "perform", "profession", "search", "sense-motive", "sleight-of-hand", "spot", "swim", "tumble", "use-magic-device", "use-rope",
    ],
    features: [
      f(1, "rogue:sneak-attack-1", "Sneak Attack +1d6"), f(1, "rogue:trapfinding", "Trapfinding"),
      f(2, "rogue:evasion", "Evasion"),
      f(3, "rogue:sneak-attack-2", "Sneak Attack +2d6"), f(3, "rogue:trap-sense-1", "Trap Sense +1"),
      f(4, "rogue:uncanny-dodge", "Uncanny Dodge"),
      f(5, "rogue:sneak-attack-3", "Sneak Attack +3d6"),
      f(6, "rogue:trap-sense-2", "Trap Sense +2"),
      f(7, "rogue:sneak-attack-4", "Sneak Attack +4d6"),
      f(8, "rogue:improved-uncanny-dodge", "Improved Uncanny Dodge"),
      f(9, "rogue:sneak-attack-5", "Sneak Attack +5d6"), f(9, "rogue:trap-sense-3", "Trap Sense +3"),
      f(10, "rogue:special-ability-10", "Special Ability", true, "special_ability"),
      f(11, "rogue:sneak-attack-6", "Sneak Attack +6d6"),
      f(12, "rogue:trap-sense-4", "Trap Sense +4"),
      f(13, "rogue:sneak-attack-7", "Sneak Attack +7d6"), f(13, "rogue:special-ability-13", "Special Ability", true, "special_ability"),
      f(15, "rogue:sneak-attack-8", "Sneak Attack +8d6"), f(15, "rogue:trap-sense-5", "Trap Sense +5"),
      f(16, "rogue:special-ability-16", "Special Ability", true, "special_ability"),
      f(17, "rogue:sneak-attack-9", "Sneak Attack +9d6"),
      f(18, "rogue:trap-sense-6", "Trap Sense +6"),
      f(19, "rogue:sneak-attack-10", "Sneak Attack +10d6"), f(19, "rogue:special-ability-19", "Special Ability", true, "special_ability"),
    ],
  }),

  sorcerer: def({
    id: "sorcerer",
    displayName: "Sorcerer",
    hitDie: 4,
    bab: "poor",
    saves: { fortitude: "poor", reflex: "poor", will: "good" },
    skillPointsPerLevel: 2,
    classSkills: ["bluff", "concentration", "craft", "knowledge:arcana", "profession", "spellcraft"],
    spellcasting: { kind: "spontaneous", tradition: "arcane", ability: "cha", startsAtClassLevel: 1, casterLevel: "full" },
    features: [f(1, "sorcerer:familiar", "Summon Familiar", true, "companion")],
  }),

  wizard: def({
    id: "wizard",
    displayName: "Wizard",
    hitDie: 4,
    bab: "poor",
    saves: { fortitude: "poor", reflex: "poor", will: "good" },
    skillPointsPerLevel: 2,
    classSkills: ["concentration", "craft", "decipher-script", "profession", "spellcraft", ...knowledge("arcana", "architecture-engineering", "dungeoneering", "geography", "history", "local", "nature", "nobility-royalty", "religion", "planes")],
    spellcasting: { kind: "prepared", tradition: "arcane", ability: "int", startsAtClassLevel: 1, casterLevel: "full", usesSpellbook: true },
    features: [
      f(1, "wizard:familiar", "Summon Familiar", true, "companion"),
      f(1, "wizard:scribe-scroll", "Scribe Scroll"),
      ...[5, 10, 15, 20].map((level) => ({
        level,
        featureId: `wizard:bonus-feat:${level}`,
        label: "Wizard Bonus Feat",
        choiceRequired: true,
        choiceType: "feat" as const,
        repeatable: true,
      })),
    ],
  }),
};

export function getCoreClass(classId: string): Dnd35ClassDefinition | undefined {
  return CORE_CLASSES[classId as CoreClassId];
}

export function featuresGrantedAtClassLevel(classId: string, classLevel: number): Dnd35ClassFeatureGrant[] {
  const cls = getCoreClass(classId);
  return cls ? cls.features.filter((feature) => feature.level === classLevel) : [];
}
