// client/src/lib/rulesAdapters/index.ts
import { dnd35Adapter } from "./dnd35";
import type { RulesAdapter } from "./types";

const ADAPTERS: Record<string, RulesAdapter> = {
  dnd35e: dnd35Adapter,
};

// The `characters`/`campaigns` tables on this branch have no `ruleset`
// column yet (confirmed in the 2026-08-17 3.5e character-system audit) —
// 3.5e is the only rules adapter that exists, so it's also the default.
// Once a ruleset field exists, route on it here; no caller needs to change.
export function getRulesAdapter(ruleset?: string | null): RulesAdapter {
  if (ruleset && ADAPTERS[ruleset]) return ADAPTERS[ruleset];
  return dnd35Adapter;
}

export type { RulesAdapter, CharacterHudModel, SaveDisplay, CarryWeightDisplay } from "./types";
