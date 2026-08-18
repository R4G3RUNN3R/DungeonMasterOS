// shared/rulesets.ts
//
// Registry of rule systems DungeonMasterOS can run a campaign under. Each
// entry is either "available" (a real, working mechanical implementation
// exists — see server/character-stats.ts / server/combat-engine.ts for the
// per-ruleset math) or "coming_soon" (registered here so the product surface
// already shows the roadmap, but no mechanical engine exists yet).
//
// "Ruleset" here means an actual mechanical system (how attack rolls, saves,
// and character math work), not a campaign setting/genre. Ravenloft and
// Eberron below are gothic-horror and magitech-adventure *flavors* built on
// top of the D&D 5e ruleset, not separate rule systems.

export type RulesetId =
  | "dnd5e"
  | "dnd35e"
  | "ravenloft"
  | "eberron"
  | "vampire-dark-fantasy"
  | "post-apocalyptic";

export interface RulesetDefinition {
  id: RulesetId;
  name: string;
  status: "available" | "coming_soon";
  baseRuleset?: RulesetId; // for settings that run on an existing ruleset's math
  description: string;
}

export const RULESETS: RulesetDefinition[] = [
  {
    id: "dnd5e",
    name: "D&D 5th Edition",
    status: "available",
    description: "Proficiency bonus, bounded accuracy, advantage/disadvantage.",
  },
  {
    id: "dnd35e",
    name: "D&D 3.5",
    status: "available",
    description: "Base attack bonus progression, skill points, per-class save tables.",
  },
  {
    id: "ravenloft",
    name: "Gothic Horror",
    status: "coming_soon",
    baseRuleset: "dnd5e",
    description: "Domains of dread, dark bargains, and powers that always cost something. Original setting content, D&D 5e math.",
  },
  {
    id: "eberron",
    name: "Magitech Adventure",
    status: "coming_soon",
    baseRuleset: "dnd5e",
    description: "Living magic, noir intrigue, and a world still recovering from a Last War. Original setting content, D&D 5e math.",
  },
  {
    id: "vampire-dark-fantasy",
    name: "Vampire Dark Fantasy",
    status: "coming_soon",
    description: "An original dark-fantasy vampire ruleset with its own mechanics — not a reproduction of any existing licensed vampire game.",
  },
  {
    id: "post-apocalyptic",
    name: "Post-Apocalyptic",
    status: "coming_soon",
    description: "An original survival-focused ruleset for a world after the fall.",
  },
];

export function getRuleset(id: string): RulesetDefinition {
  return RULESETS.find((r) => r.id === id) ?? RULESETS[0];
}

export function isAvailableRuleset(id: string): boolean {
  return getRuleset(id).status === "available";
}
