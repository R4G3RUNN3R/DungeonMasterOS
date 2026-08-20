// client/src/lib/rulesAdapters/types.ts
//
// The rules presentation adapter boundary (design spec §15). Generic game-
// shell UI (CharacterHud, etc.) reads only this shape — it never reaches
// into a ruleset's raw character data directly. That's what keeps 3.5e
// specifics out of components that need to stay ruleset-agnostic.
//
// Every field is nullable on purpose: missing data must render as visibly
// unknown, never invented (spec §19). A null here means "we don't have this
// value," not "the value is zero."

export interface SaveDisplay {
  key: string;
  label: string;
  value: number | null;
}

export interface CarryWeightDisplay {
  current: number | null;
  max: number | null;
  tier: "light" | "medium" | "heavy" | "overloaded" | null;
}

export interface CharacterHudModel {
  name: string;
  race: string | null;
  classSummary: string | null;
  age: string | null;
  alignment: string | null;
  portraitUrl: string | null;
  hp: { current: number; max: number } | null;
  ac: number | null;
  initiative: number | null;
  speed: number | null;
  attacksPerRound: number | null;
  carryWeight: CarryWeightDisplay | null;
  saves: SaveDisplay[];
}

// The server's authoritative save computation (server/character-stats.ts's
// FullCharacterSheet.saves) — structurally compatible, not imported, since
// this is client code. Passing it in (rather than recomputing saves from
// characterData here) is what keeps the HUD from ever disagreeing with the
// full Character Sheet, or silently showing stale/never-written data.
export interface AuthoritativeSaveEntry {
  key: string;
  label: string;
  total: number;
  proficient: boolean;
}

export interface RulesAdapter {
  ruleset: string;
  /**
   * Projects raw character (+ that character's items, for Carry Weight) into
   * a display-safe HUD model. `authoritativeSaves`, when available, comes
   * from the same server computation the full Character Sheet uses; when
   * absent (e.g. still loading), the adapter may fall back to a cached
   * approximation rather than showing nothing.
   */
  buildCharacterHud(character: any, items?: any[], authoritativeSaves?: AuthoritativeSaveEntry[]): CharacterHudModel;
}
