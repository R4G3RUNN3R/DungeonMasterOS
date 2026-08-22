// shared/rules-registry/primitives.ts
//
// Shared vocabulary for concepts that recur across every future canonical
// entity type (design spec §1, §11). Defined before any entity table is
// built so the Bestiary, spells, feats, etc. all reference the SAME
// identifiers for the same concepts, rather than each re-encoding
// "immune to fire" or "flat-footed" independently. Non-spell power
// systems get their own PowerSystem identity — never silently folded
// into "spell" (design spec's locked decision, Overview + §1).

export type PowerSystem =
  | "spell"
  | "psionic"
  | "invocation"
  | "maneuver"
  | "incarnum"
  | "binding"
  | "shadow-magic"
  | "truenaming";

export type ConditionId =
  | "blinded" | "confused" | "cowering" | "dazed" | "dazzled" | "deafened"
  | "entangled" | "exhausted" | "fascinated" | "fatigued" | "flat-footed"
  | "frightened" | "grappling" | "helpless" | "incorporeal" | "invisible"
  | "nauseated" | "panicked" | "paralyzed" | "petrified" | "pinned"
  | "prone" | "shaken" | "sickened" | "stable" | "staggered" | "stunned"
  | "unconscious";

export type ActionType = "standard" | "move" | "full-round" | "free" | "swift" | "immediate";

export type CreatureType =
  | "aberration" | "animal" | "construct" | "dragon" | "elemental" | "fey"
  | "giant" | "humanoid" | "magical-beast" | "monstrous-humanoid" | "ooze"
  | "outsider" | "plant" | "shapechanger" | "undead" | "vermin";

export type CreatureSubtype =
  | "air" | "aquatic" | "augmented" | "chaotic" | "cold" | "earth" | "evil"
  | "extraplanar" | "fire" | "good" | "incorporeal" | "lawful" | "native"
  | "psionic" | "shapechanger" | "swarm" | "water";
