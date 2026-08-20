// client/src/lib/characterSheetTypes.ts
//
// The shared contract for GET /api/characters/:id/sheet (server/character-
// stats.ts's computeFullCharacterSheet). Consumed by the canonical full
// Character Sheet page (pages/CharacterSheetPage.tsx), the Character
// Overview summary (components/SidebarCharacterSheet.tsx), and the rules
// adapters. Not a component file — the old CharacterSheetModal component
// this type used to live alongside was superseded by CharacterSheetPage
// and removed; only its type contract survived.

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface SaveEntry {
  key: string;
  label: string;
  total: number;
  proficient: boolean;
}

export interface FullCharacterSheet {
  ruleset: string;
  abilities: Record<Ability, { score: number; modifier: number }>;
  skills: Array<{ name: string; ability: Ability; total: number; proficient: boolean }>;
  saves: SaveEntry[];
  attack: { total: number; extraAttackBonuses: number[] };
}
