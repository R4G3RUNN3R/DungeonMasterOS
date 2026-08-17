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

import type { CharacterHudModel, RulesAdapter } from "./types";

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

export const dnd35Adapter: RulesAdapter = {
  ruleset: "dnd35e",

  buildCharacterHud(character): CharacterHudModel {
    const characterData = safeParseCharacterData(character?.characterData);
    const sheet = characterData?.dnd35Sheet ?? {};
    const identity = sheet.identity ?? {};
    const combat = sheet.combat ?? {};
    const saves = sheet.saves ?? {};

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
      // Encumbrance has no authoritative source yet (spec §16 / Phase 6) —
      // stays null rather than a fabricated number.
      carryWeight: null,
      saves: [
        { key: "fortitude", label: "Fort", value: typeof saves.fortitude?.total === "number" ? saves.fortitude.total : null },
        { key: "reflex", label: "Ref", value: typeof saves.reflex?.total === "number" ? saves.reflex.total : null },
        { key: "will", label: "Will", value: typeof saves.will?.total === "number" ? saves.will.total : null },
      ],
    };
  },
};
