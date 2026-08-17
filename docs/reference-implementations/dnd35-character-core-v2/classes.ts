// Reference implementation only. This is class progression metadata, not a full spell/feat database.

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
  /** A player must choose the specific option rather than the engine inventing it. */
  choiceRequired?: boolean;
  choiceType?: "feat" | "favored_enemy" | "combat_style" | "special_ability" | "other";
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
};

const def = (value: Dnd35ClassDefinition) => value;

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
    features: [
      { level: 1, featureId: "barbarian:fast-movement", label: "Fast Movement" },
      { level: 1, featureId: "barbarian:illiteracy", label: "Illiteracy" },
      { level: 1, featureId: "barbarian:rage", label: "Rage 1/day" },
      { level: 2, featureId: "barbarian:uncanny-dodge", label: "Uncanny Dodge" },
      { level: 3, featureId: "barbarian:trap-sense", label: "Trap Sense +1" },
      { level: 4, featureId: "barbarian:rage-2", label: "Rage 2/day" },
      { level: 5, featureId: "barbarian:improved-uncanny-dodge", label: "Improved Uncanny Dodge" },
      { level: 6, featureId: "barbarian:trap-sense-2", label: "Trap Sense +2" },
      { level: 7, featureId: "barbarian:damage-reduction-1", label: "Damage Reduction 1/-" },
      { level: 8, featureId: "barbarian:rage-3", label: "Rage 3/day" },
      { level: 9, featureId: "barbarian:trap-sense-3", label: "Trap Sense +3" },
      { level: 10, featureId: "barbarian:damage-reduction-2", label: "Damage Reduction 2/-" },
      { level: 11, featureId: "barbarian:greater-rage", label: "Greater Rage" },
      { level: 12, featureId: "barbarian:rage-4", label: "Rage 4/day" },
      { level: 12, featureId: "barbarian:trap-sense-4", label: "Trap Sense +4" },
      { level: 13, featureId: "barbarian:damage-reduction-3", label: "Damage Reduction 3/-" },
      { level: 14, featureId: "barbarian:indomitable-will", label: "Indomitable Will" },
      { level: 15, featureId: "barbarian:trap-sense-5", label: "Trap Sense +5" },
      { level: 16, featureId: "barbarian:damage-reduction-4", label: "Damage Reduction 4/-" },
      { level: 16, featureId: "barbarian:rage-5", label: "Rage 5/day" },
      { level: 17, featureId: "barbarian:tireless-rage", label: "Tireless Rage" },
      { level: 18, featureId: "barbarian:trap-sense-6", label: "Trap Sense +6" },
      { level: 19, featureId: "barbarian:damage-reduction-5", label: "Damage Reduction 5/-" },
      { level: 20, featureId: "barbarian:mighty-rage", label: "Mighty Rage" },
      { level: 20, featureId: "barbarian:rage-6", label: "Rage 6/day" },
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
    features: [
      { level: 1, featureId: "bard:bardic-knowledge", label: "Bardic Knowledge" },
      { level: 1, featureId: "bard:bardic-music", label: "Bardic Music" },
      { level: 1, featureId: "bard:countersong", label: "Countersong" },
      { level: 1, featureId: "bard:fascinate", label: "Fascinate" },
      { level: 1, featureId: "bard:inspire-courage-1", label: "Inspire Courage +1" },
      { level: 3, featureId: "bard:inspire-competence", label: "Inspire Competence" },
      { level: 6, featureId: "bard:suggestion", label: "Suggestion" },
      { level: 8, featureId: "bard:inspire-courage-2", label: "Inspire Courage +2" },
      { level: 9, featureId: "bard:inspire-greatness", label: "Inspire Greatness" },
      { level: 12, featureId: "bard:song-of-freedom", label: "Song of Freedom" },
      { level: 14, featureId: "bard:inspire-courage-3", label: "Inspire Courage +3" },
      { level: 15, featureId: "bard:inspire-heroics", label: "Inspire Heroics" },
      { level: 18, featureId: "bard:mass-suggestion", label: "Mass Suggestion" },
      { level: 20, featureId: "bard:inspire-courage-4", label: "Inspire Courage +4" },
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
      { level: 1, featureId: "cleric:domains", label: "Two domains", choiceRequired: true, choiceType: "other" },
      { level: 1, featureId: "cleric:turn-rebuke-undead", label: "Turn or Rebuke Undead", choiceRequired: true, choiceType: "other" },
      { level: 1, featureId: "cleric:spontaneous-casting", label: "Spontaneous cure/inflict conversion" },
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
    features: [
      { level: 1, featureId: "druid:animal-companion", label: "Animal Companion", choiceRequired: true, choiceType: "other" },
      { level: 1, featureId: "druid:nature-sense", label: "Nature Sense" },
      { level: 1, featureId: "druid:wild-empathy", label: "Wild Empathy" },
      { level: 2, featureId: "druid:woodland-stride", label: "Woodland Stride" },
      { level: 3, featureId: "druid:trackless-step", label: "Trackless Step" },
      { level: 4, featureId: "druid:resist-natures-lure", label: "Resist Nature's Lure" },
      { level: 5, featureId: "druid:wild-shape-1", label: "Wild Shape 1/day" },
      { level: 6, featureId: "druid:wild-shape-2", label: "Wild Shape 2/day" },
      { level: 7, featureId: "druid:wild-shape-3", label: "Wild Shape 3/day" },
      { level: 8, featureId: "druid:wild-shape-large", label: "Wild Shape (Large)" },
      { level: 9, featureId: "druid:venom-immunity", label: "Venom Immunity" },
      { level: 10, featureId: "druid:wild-shape-4", label: "Wild Shape 4/day" },
      { level: 11, featureId: "druid:wild-shape-tiny", label: "Wild Shape (Tiny)" },
      { level: 12, featureId: "druid:wild-shape-5", label: "Wild Shape 5/day" },
      { level: 13, featureId: "druid:thousand-faces", label: "A Thousand Faces" },
      { level: 14, featureId: "druid:wild-shape-6", label: "Wild Shape 6/day" },
      { level: 15, featureId: "druid:timeless-body", label: "Timeless Body" },
      { level: 15, featureId: "druid:wild-shape-huge", label: "Wild Shape (Huge)" },
      { level: 16, featureId: "druid:elemental-shape-1", label: "Elemental Wild Shape 1/day" },
      { level: 18, featureId: "druid:elemental-shape-2", label: "Elemental Wild Shape 2/day" },
      { level: 20, featureId: "druid:elemental-shape-3", label: "Elemental Wild Shape 3/day" },
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
    features: [
      { level: 1, featureId: "monk:bonus-feat-1", label: "Monk Bonus Feat", choiceRequired: true, choiceType: "feat" },
      { level: 1, featureId: "monk:flurry", label: "Flurry of Blows" },
      { level: 1, featureId: "monk:unarmed-strike", label: "Unarmed Strike" },
      { level: 2, featureId: "monk:bonus-feat-2", label: "Monk Bonus Feat", choiceRequired: true, choiceType: "feat" },
      { level: 2, featureId: "monk:evasion", label: "Evasion" },
      { level: 3, featureId: "monk:still-mind", label: "Still Mind" },
      { level: 3, featureId: "monk:fast-movement", label: "Fast Movement +10 ft." },
      { level: 4, featureId: "monk:ki-strike-magic", label: "Ki Strike (magic)" },
      { level: 4, featureId: "monk:slow-fall-20", label: "Slow Fall 20 ft." },
      { level: 5, featureId: "monk:purity-body", label: "Purity of Body" },
      { level: 6, featureId: "monk:bonus-feat-6", label: "Monk Bonus Feat", choiceRequired: true, choiceType: "feat" },
      { level: 6, featureId: "monk:slow-fall-30", label: "Slow Fall 30 ft." },
      { level: 7, featureId: "monk:wholeness-body", label: "Wholeness of Body" },
      { level: 8, featureId: "monk:slow-fall-40", label: "Slow Fall 40 ft." },
      { level: 9, featureId: "monk:improved-evasion", label: "Improved Evasion" },
      { level: 10, featureId: "monk:ki-strike-lawful", label: "Ki Strike (lawful)" },
      { level: 10, featureId: "monk:slow-fall-50", label: "Slow Fall 50 ft." },
      { level: 11, featureId: "monk:diamond-body", label: "Diamond Body" },
      { level: 11, featureId: "monk:greater-flurry", label: "Greater Flurry" },
      { level: 12, featureId: "monk:abundant-step", label: "Abundant Step" },
      { level: 12, featureId: "monk:slow-fall-60", label: "Slow Fall 60 ft." },
      { level: 13, featureId: "monk:diamond-soul", label: "Diamond Soul" },
      { level: 14, featureId: "monk:slow-fall-70", label: "Slow Fall 70 ft." },
      { level: 15, featureId: "monk:quivering-palm", label: "Quivering Palm" },
      { level: 16, featureId: "monk:ki-strike-adamantine", label: "Ki Strike (adamantine)" },
      { level: 16, featureId: "monk:slow-fall-80", label: "Slow Fall 80 ft." },
      { level: 17, featureId: "monk:timeless-body", label: "Timeless Body" },
      { level: 17, featureId: "monk:tongue-sun-moon", label: "Tongue of the Sun and Moon" },
      { level: 18, featureId: "monk:slow-fall-90", label: "Slow Fall 90 ft." },
      { level: 19, featureId: "monk:empty-body", label: "Empty Body" },
      { level: 20, featureId: "monk:perfect-self", label: "Perfect Self" },
      { level: 20, featureId: "monk:slow-fall-any", label: "Slow Fall (any distance)" },
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
    features: [
      { level: 1, featureId: "paladin:aura-good", label: "Aura of Good" },
      { level: 1, featureId: "paladin:detect-evil", label: "Detect Evil" },
      { level: 1, featureId: "paladin:smite-evil-1", label: "Smite Evil 1/day" },
      { level: 2, featureId: "paladin:divine-grace", label: "Divine Grace" },
      { level: 2, featureId: "paladin:lay-on-hands", label: "Lay on Hands" },
      { level: 3, featureId: "paladin:aura-courage", label: "Aura of Courage" },
      { level: 3, featureId: "paladin:divine-health", label: "Divine Health" },
      { level: 4, featureId: "paladin:turn-undead", label: "Turn Undead" },
      { level: 5, featureId: "paladin:smite-evil-2", label: "Smite Evil 2/day" },
      { level: 5, featureId: "paladin:special-mount", label: "Special Mount" },
      { level: 6, featureId: "paladin:remove-disease-1", label: "Remove Disease 1/week" },
      { level: 9, featureId: "paladin:remove-disease-2", label: "Remove Disease 2/week" },
      { level: 10, featureId: "paladin:smite-evil-3", label: "Smite Evil 3/day" },
      { level: 12, featureId: "paladin:remove-disease-3", label: "Remove Disease 3/week" },
      { level: 15, featureId: "paladin:smite-evil-4", label: "Smite Evil 4/day" },
      { level: 15, featureId: "paladin:remove-disease-4", label: "Remove Disease 4/week" },
      { level: 18, featureId: "paladin:remove-disease-5", label: "Remove Disease 5/week" },
      { level: 20, featureId: "paladin:smite-evil-5", label: "Smite Evil 5/day" },
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
      { level: 1, featureId: "ranger:favored-enemy-1", label: "Favored Enemy", choiceRequired: true, choiceType: "favored_enemy" },
      { level: 1, featureId: "ranger:track", label: "Track" },
      { level: 1, featureId: "ranger:wild-empathy", label: "Wild Empathy" },
      { level: 2, featureId: "ranger:combat-style", label: "Combat Style", choiceRequired: true, choiceType: "combat_style" },
      { level: 3, featureId: "ranger:endurance", label: "Endurance" },
      { level: 4, featureId: "ranger:animal-companion", label: "Animal Companion", choiceRequired: true, choiceType: "other" },
      { level: 5, featureId: "ranger:favored-enemy-2", label: "Favored Enemy", choiceRequired: true, choiceType: "favored_enemy" },
      { level: 6, featureId: "ranger:improved-combat-style", label: "Improved Combat Style" },
      { level: 7, featureId: "ranger:woodland-stride", label: "Woodland Stride" },
      { level: 8, featureId: "ranger:swift-tracker", label: "Swift Tracker" },
      { level: 9, featureId: "ranger:evasion", label: "Evasion" },
      { level: 10, featureId: "ranger:favored-enemy-3", label: "Favored Enemy", choiceRequired: true, choiceType: "favored_enemy" },
      { level: 11, featureId: "ranger:combat-style-mastery", label: "Combat Style Mastery" },
      { level: 13, featureId: "ranger:camouflage", label: "Camouflage" },
      { level: 15, featureId: "ranger:favored-enemy-4", label: "Favored Enemy", choiceRequired: true, choiceType: "favored_enemy" },
      { level: 17, featureId: "ranger:hide-in-plain-sight", label: "Hide in Plain Sight" },
      { level: 20, featureId: "ranger:favored-enemy-5", label: "Favored Enemy", choiceRequired: true, choiceType: "favored_enemy" },
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
      { level: 1, featureId: "rogue:sneak-attack-1", label: "Sneak Attack +1d6" },
      { level: 1, featureId: "rogue:trapfinding", label: "Trapfinding" },
      { level: 2, featureId: "rogue:evasion", label: "Evasion" },
      { level: 3, featureId: "rogue:sneak-attack-2", label: "Sneak Attack +2d6" },
      { level: 3, featureId: "rogue:trap-sense-1", label: "Trap Sense +1" },
      { level: 4, featureId: "rogue:uncanny-dodge", label: "Uncanny Dodge" },
      { level: 5, featureId: "rogue:sneak-attack-3", label: "Sneak Attack +3d6" },
      { level: 6, featureId: "rogue:trap-sense-2", label: "Trap Sense +2" },
      { level: 7, featureId: "rogue:sneak-attack-4", label: "Sneak Attack +4d6" },
      { level: 8, featureId: "rogue:improved-uncanny-dodge", label: "Improved Uncanny Dodge" },
      { level: 9, featureId: "rogue:sneak-attack-5", label: "Sneak Attack +5d6" },
      { level: 9, featureId: "rogue:trap-sense-3", label: "Trap Sense +3" },
      { level: 10, featureId: "rogue:special-ability-10", label: "Special Ability", choiceRequired: true, choiceType: "special_ability" },
      { level: 11, featureId: "rogue:sneak-attack-6", label: "Sneak Attack +6d6" },
      { level: 12, featureId: "rogue:trap-sense-4", label: "Trap Sense +4" },
      { level: 13, featureId: "rogue:sneak-attack-7", label: "Sneak Attack +7d6" },
      { level: 13, featureId: "rogue:special-ability-13", label: "Special Ability", choiceRequired: true, choiceType: "special_ability" },
      { level: 15, featureId: "rogue:sneak-attack-8", label: "Sneak Attack +8d6" },
      { level: 15, featureId: "rogue:trap-sense-5", label: "Trap Sense +5" },
      { level: 16, featureId: "rogue:special-ability-16", label: "Special Ability", choiceRequired: true, choiceType: "special_ability" },
      { level: 17, featureId: "rogue:sneak-attack-9", label: "Sneak Attack +9d6" },
      { level: 18, featureId: "rogue:trap-sense-6", label: "Trap Sense +6" },
      { level: 19, featureId: "rogue:sneak-attack-10", label: "Sneak Attack +10d6" },
      { level: 19, featureId: "rogue:special-ability-19", label: "Special Ability", choiceRequired: true, choiceType: "special_ability" },
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
    features: [{ level: 1, featureId: "sorcerer:familiar", label: "Summon Familiar", choiceRequired: true, choiceType: "other" }],
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
      { level: 1, featureId: "wizard:familiar", label: "Summon Familiar", choiceRequired: true, choiceType: "other" },
      { level: 1, featureId: "wizard:scribe-scroll", label: "Scribe Scroll" },
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
