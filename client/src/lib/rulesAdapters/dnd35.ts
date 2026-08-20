// client/src/lib/rulesAdapters/dnd35.ts
//
// D&D 3.5e rules adapter. Projects from shared/dnd35-character-sheet.ts's
// `characterData.dnd35Sheet` contract (the one place that structured 3.5e
// data actually lives today) plus the live `characters` row fields that are
// already authoritative (hp/maxHp/speed/attacksPerRound/name/race/charClass).
//
// This does not invent AC, initiative, or saves when the sheet hasn't been
// populated yet — per the 3.5e character-system audit, most characters have
// no writer for those fields today, so they correctly render as unknown
// here rather than as a fabricated 0 or 10.
//
// Carry Weight (spec §16 / Phase 6) uses the character's real Strength
// score when the 3.5e sheet has one, falling back to a documented
// simplified level-derived capacity otherwise (shared/encumbrance.ts) —
// never a fabricated number, but no longer a permanent null either.

import type { AuthoritativeSaveEntry, CharacterHudModel, RulesAdapter, SaveDisplay } from "./types";
import {
  carryingCapacityForStrength,
  defaultCarryingCapacityForLevel,
  computeEncumbrance,
} from "@shared/encumbrance";

function safeParseCharacterData(raw: unknown): any {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function classSummaryFromSheet(identity: any, fallbackCharClass: unknown): string | null {
  if (Array.isArray(identity?.classes) && identity.classes.length > 0) {
    const parts = identity.classes
      .filter((c: any) => c && typeof c.className === "string" && c.className.trim())
      .map((c: any) => (typeof c.level === "number" ? `${c.className} ${c.level}` : c.className));
    if (parts.length > 0) return parts.join(" / ");
  }
  return typeof fallbackCharClass === "string" && fallbackCharClass.trim() ? fallbackCharClass : null;
}

function buildCarryWeight(abilities: any, character: any, items: any[] | undefined) {
  if (!Array.isArray(items)) return { current: null, max: null, tier: null };

  const strScore = typeof abilities?.str?.score === "number" ? abilities.str.score : null;
  const capacity =
    strScore !== null
      ? carryingCapacityForStrength(strScore)
      : defaultCarryingCapacityForLevel(typeof character?.level === "number" ? character.level : 1);

  const state = computeEncumbrance(items, capacity);
  return {
    current: Math.round(state.totalWeight * 10) / 10,
    max: capacity.heavy,
    tier: state.tier,
  };
}

// Prefer the server's authoritative save computation (same source the full
// Character Sheet reads — see server/character-stats.ts's buildSaves) when
// it's available. Fall back to the characterData.dnd35Sheet JSON blob only
// while that fetch hasn't resolved yet, so the HUD doesn't flash "—" on
// every page load; the blob is never treated as the source of truth once
// the authoritative data has arrived.
function buildSaveDisplay(authoritativeSaves: AuthoritativeSaveEntry[] | undefined, blobSaves: any): SaveDisplay[] {
  if (authoritativeSaves && authoritativeSaves.length > 0) {
    return authoritativeSaves.map((s) => ({ key: s.key, label: s.label, value: s.total }));
  }
  return [
    { key: "fortitude", label: "Fort", value: typeof blobSaves.fortitude?.total === "number" ? blobSaves.fortitude.total : null },
    { key: "reflex", label: "Ref", value: typeof blobSaves.reflex?.total === "number" ? blobSaves.reflex.total : null },
    { key: "will", label: "Will", value: typeof blobSaves.will?.total === "number" ? blobSaves.will.total : null },
  ];
}

export const dnd35Adapter: RulesAdapter = {
  ruleset: "dnd35e",

  buildCharacterHud(character, items, authoritativeSaves): CharacterHudModel {
    const characterData = safeParseCharacterData(character?.characterData);
    const sheet = characterData?.dnd35Sheet ?? {};
    const identity = sheet.identity ?? {};
    const combat = sheet.combat ?? {};
    const saves = sheet.saves ?? {};
    const abilities = sheet.abilities ?? {};

    const hp =
      typeof character?.hp === "number" && typeof character?.maxHp === "number"
        ? { current: character.hp, max: character.maxHp }
        : null;

    return {
      name: typeof character?.name === "string" ? character.name : "Unknown",
      race: typeof identity.race === "string" && identity.race.trim() ? identity.race : (character?.race ?? null),
      classSummary: classSummaryFromSheet(identity, character?.charClass),
      age: identity.age != null ? String(identity.age) : null,
      alignment: typeof identity.alignment === "string" && identity.alignment.trim() ? identity.alignment : null,
      // No portrait system exists yet (spec §5 — first pass only needs the
      // slot). Always null here; CharacterHud renders its default medallion.
      portraitUrl: null,
      hp,
      ac: typeof combat.armorClass?.total === "number" ? combat.armorClass.total : null,
      initiative: typeof combat.initiative?.total === "number" ? combat.initiative.total : null,
      speed: typeof character?.speed === "number" ? character.speed : (sheet.movement?.land ?? null),
      attacksPerRound: typeof character?.attacksPerRound === "number" ? character.attacksPerRound : null,
      carryWeight: buildCarryWeight(abilities, character, items),
      saves: buildSaveDisplay(authoritativeSaves, saves),
    };
  },
};
