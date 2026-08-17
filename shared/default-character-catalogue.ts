import {
  DEFAULT_CHARACTERS,
  type DefaultCharacterPreset,
} from "./default-characters";
import { DEFAULT_SORCERER } from "./default-sorcerer";

/**
 * Canonical growing catalogue for the D&D 3.5e starter picker.
 * Use this export for new UI/API integrations rather than the original
 * ten-preset array, which is retained for backwards compatibility.
 */
export const ALL_DEFAULT_CHARACTERS: DefaultCharacterPreset[] = [
  ...DEFAULT_CHARACTERS,
  DEFAULT_SORCERER,
];

export const ALL_DEFAULT_CHARACTER_BY_ID: Record<string, DefaultCharacterPreset> =
  Object.fromEntries(
    ALL_DEFAULT_CHARACTERS.map((character) => [character.id, character]),
  );

export function getAllDefaultCharacterPreset(
  id: string | null | undefined,
): DefaultCharacterPreset | undefined {
  if (!id) return undefined;
  return ALL_DEFAULT_CHARACTER_BY_ID[id];
}
