import type { Express, Request } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { levelForXp } from "./leveling";
import {
  evaluateCharacterForDnd35Feat,
  getDnd35Feat,
  getDnd35Spell,
  getKnowledgeShelves,
  listPublicDnd35Feats,
  listPublicDnd35Spells,
  publicDnd35Feat,
  publicDnd35Spell,
  readStoredDnd35FeatSelections,
  recordDnd35FeatSelection,
  resolveCanonicalItemDefinition,
} from "./knowledge-library";
import {
  consumeCharacterDnd35SpellUse,
  findDnd35CastSpell,
  resolveCharacterDnd35SpellCast,
} from "./dnd35-spellcasting";
import type { Dnd35FeatDefinition } from "@shared/dnd35-rules/types";

const FEAT_CATEGORIES = new Set<Dnd35FeatDefinition["categories"][number]>([
  "general", "fighter_bonus", "metamagic", "item_creation", "divine", "tactical", "reserve", "heritage", "racial", "monstrous", "exalted", "vile", "epic", "special", "other",
]);
const ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

function stringQuery(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value.trim() : "";
}

function canReadCharacter(req: Request, character: any) {
  if (!req.user) return false;
  if (req.user.isAdmin || req.user.role === "dungeon_master") return true;
  if (character.userId && character.userId === req.user.id) return true;
  const campaign = storage.getCampaign(character.campaignId);
  return !!campaign && campaign.userId === req.user.id;
}

function ownsCharacter(req: Request, character: any) {
  if (!req.user) return false;
  return character.userId === req.user.id || character.visitorId === `user-${req.user.id}` || req.user.isAdmin;
}

function actionText(body: any) {
  if (!body || typeof body !== "object") return "";
  for (const key of ["content", "action", "message", "text"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function featParameterValues(body: any): Record<string, string | string[]> | undefined {
  const raw = body?.featParameters;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim()) {
      result[key] = value.trim();
    } else if (Array.isArray(value)) {
      const cleaned = value.filter((entry): entry is string => typeof entry === "string" && !!entry.trim()).map((entry) => entry.trim());
      if (cleaned.length) result[key] = cleaned;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function parameterErrors(feat: Dnd35FeatDefinition, parameters: Record<string, string | string[]> | undefined) {
  const failures: string[] = [];
  for (const parameter of feat.parameters ?? []) {
    if (!parameter.required) continue;
    const value = parameters?.[parameter.id];
    const hasValue = Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
    if (!hasValue) failures.push(`${feat.name} requires a ${parameter.id} selection.`);
    if (parameter.allowedValues?.length && typeof value === "string" && !parameter.allowedValues.includes(value)) {
      failures.push(`${value} is not an allowed ${parameter.id} selection for ${feat.name}.`);
    }
  }
  return failures;
}

function parameterSpecificPrerequisiteErrors(feat: Dnd35FeatDefinition, parameters: Record<string, string | string[]> | undefined, character: any) {
  const stored = readStoredDnd35FeatSelections(character);
  if (feat.id === "greater-spell-focus") {
    const school = parameters?.school;
    const hasMatchingFocus = typeof school === "string" && stored.some((entry) => entry.featId === "spell-focus" && entry.parameters?.school === school);
    return hasMatchingFocus ? [] : ["Greater Spell Focus requires Spell Focus in the same selected school."];
  }
  return [];
}

function sameRepeatSelection(feat: Dnd35FeatDefinition, parameters: Record<string, string | string[]> | undefined, character: any) {
  if (!feat.repeatable) return false;
  const stored = readStoredDnd35FeatSelections(character).filter((entry) => entry.featId === feat.id);
  if (!stored.length) return false;
  return stored.some((entry) => JSON.stringify(entry.parameters ?? {}) === JSON.stringify(parameters ?? {}));
}

function canonicalItemType(category: string, fallback: string) {
  const normalized = category.trim().toLowerCase();
  const allowed = new Set(["weapon", "armor", "consumable", "gear", "magic", "key", "currency", "misc", "mount", "vessel", "property", "vehicle", "creature", "retainer", "tool"]);
  if (allowed.has(normalized)) return normalized;
  if (normalized.includes("weapon")) return "weapon";
  if (normalized.includes("armor") || normalized.includes("armour") || normalized.includes("shield")) return "armor";
  if (normalized.includes("potion") || normalized.includes("poison") || normalized.includes("consumable")) return "consumable";
  if (normalized.includes("magic") || normalized.includes("wondrous")) return "magic";
  return fallback || "gear";
}

function canonicalStatMods(definition: any, fallback: string) {
  const mods = Array.isArray(definition?.effects)
    ? definition.effects.flatMap((effect: any) => {
        if (!effect || effect.type !== "stat_mod" || typeof effect.stat !== "string" || !Number.isFinite(Number(effect.modifier))) return [];
        return [{ stat: effect.stat, type: "bonus", modifier: Number(effect.modifier), source: definition.name }];
      })
    : [];
  return mods.length ? JSON.stringify(mods) : fallback;
}

function canonicalizeGrantedItems(campaign: any, characterId: number, beforeIds: Set<number>) {
  const newItems = storage.getItemsByCharacter(characterId).filter((item) => !beforeIds.has(item.id));
  const reconciled: Array<{ itemId: number; name: string; canonical: boolean; definitionKey?: string; ruleset: string }> = [];

  for (const item of newItems) {
    const definition = resolveCanonicalItemDefinition(campaign.ruleset, item.name);
    if (!definition) {
      storage.updateItem(item.id, { source: `dm-homebrew-unverified:${campaign.ruleset}` } as any);
      reconciled.push({ itemId: item.id, name: item.name, canonical: false, ruleset: campaign.ruleset });
      continue;
    }

    const mechanics = definition.mechanics as Record<string, unknown>;
    const canonicalDamage = typeof mechanics?.baseDamage === "string"
      ? mechanics.baseDamage
      : typeof mechanics?.damageDice === "string"
        ? mechanics.damageDice
        : item.weaponDamageDice;
    const updates: any = {
      source: `knowledge:${definition.definitionKey}`,
      itemType: canonicalItemType(definition.category, item.itemType),
      consumable: definition.consumable,
      weight: definition.weight ?? item.weight,
      weaponDamageDice: canonicalDamage,
      statMods: canonicalStatMods(definition, item.statMods),
    };
    if (item.identified) {
      updates.name = definition.name;
      updates.description = definition.description;
    } else {
      updates.trueName = definition.name;
      updates.trueDescription = definition.description;
    }
    storage.updateItem(item.id, updates);
    reconciled.push({ itemId: item.id, name: definition.name, canonical: true, definitionKey: definition.definitionKey, ruleset: definition.ruleset });
  }

  return reconciled;
}

function dnd35GrantsFeat(level: number) {
  return level >= 3 && level % 3 === 0;
}

function dnd35GrantsAbilityIncrease(level: number) {
  return level >= 4 && level % 4 === 0;
}

function ensureFeatInGenericCharacterData(character: any, feat: Dnd35FeatDefinition) {
  let data: any;
  try { data = JSON.parse(character.characterData || "{}"); } catch { data = {}; }
  if (!Array.isArray(data.sections)) data.sections = [];
  let section = data.sections.find((entry: any) => entry?.label === "Feats & Features");
  if (!section) {
    section = { label: "Feats & Features", content: "" };
    data.sections.push(section);
  }
  const lines = String(section.content || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.some((line) => line.toLowerCase() === feat.name.toLowerCase())) {
    lines.push(feat.name);
    section.content = lines.join("\n");
    storage.updateCharacter(character.id, { characterData: JSON.stringify(data) } as any);
  }
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function registerKnowledgeRoutes(app: Express): void {
  app.get("/api/knowledge/library", (_req, res) => {
    return res.json({ title: "The Library of Knowledge", shelves: getKnowledgeShelves() });
  });

  app.get("/api/knowledge/dnd35/spells", (req, res) => {
    const tradition = stringQuery(req, "tradition");
    if (tradition && tradition !== "arcane" && tradition !== "divine" && tradition !== "other") {
      return res.status(400).json({ message: "Unknown spell tradition." });
    }
    return res.json({ edition: "3.5e", corpusStatus: "foundation", spells: listPublicDnd35Spells({ tradition: tradition as any || undefined, query: stringQuery(req, "q") || undefined }) });
  });

  app.get("/api/knowledge/dnd35/spells/:id", (req, res) => {
    const spell = getDnd35Spell(String(req.params.id || ""));
    if (!spell) return res.status(404).json({ message: "Spell is not yet present in the canonical 3.5 corpus." });
    return res.json(publicDnd35Spell(spell));
  });

  app.get("/api/knowledge/dnd35/feats", (req, res) => {
    const categoryText = stringQuery(req, "category");
    const category = categoryText && FEAT_CATEGORIES.has(categoryText as any) ? categoryText as Dnd35FeatDefinition["categories"][number] : undefined;
    if (categoryText && !category) return res.status(400).json({ message: "Unknown feat category." });
    return res.json({ edition: "3.5e", corpusStatus: "foundation", feats: listPublicDnd35Feats({ category, query: stringQuery(req, "q") || undefined }) });
  });

  app.get("/api/knowledge/dnd35/feats/:id", (req, res) => {
    const feat = getDnd35Feat(String(req.params.id || ""));
    if (!feat) return res.status(404).json({ message: "Feat is not yet present in the canonical D&D 3.5 feat corpus." });
    return res.json(publicDnd35Feat(feat));
  });

  app.get("/api/knowledge/dnd35/characters/:characterId/eligible-feats", requireAuth, (req, res) => {
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found." });
    if (!ownsCharacter(req, character)) return res.status(403).json({ message: "Not your character." });
    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign || campaign.ruleset !== "dnd35e") return res.status(400).json({ message: "This character is not in a D&D 3.5e campaign." });

    const selected = readStoredDnd35FeatSelections(character);
    const feats = listPublicDnd35Feats({}).map((feat: any) => {
      const canonical = getDnd35Feat(feat.id)!;
      const qualification = evaluateCharacterForDnd35Feat(character, canonical, storage);
      return { ...feat, selected: selected.some((entry) => entry.featId === feat.id), qualified: qualification.qualified, failures: qualification.failures };
    });
    return res.json({ edition: "3.5e", feats });
  });

  app.post("/api/campaigns/:id/action", requireAuth, (req, res, next) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return next();

    const visitorId = `user-${req.user!.id}`;
    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return next();
    const beforeItemIds = new Set(storage.getItemsByCharacter(character.id).map((item) => item.id));
    const text = actionText(req.body);

    let castPreflight: ReturnType<typeof resolveCharacterDnd35SpellCast> | undefined;
    if (campaign.ruleset === "dnd35e" && text) {
      const spell = findDnd35CastSpell(text);
      if (spell) {
        castPreflight = resolveCharacterDnd35SpellCast(character, spell, text, storage.getItemsByCharacter(character.id), storage.getActiveEffectsByCharacter(character.id));
        if (castPreflight.unavailableReason) {
          return res.status(409).json({ message: castPreflight.unavailableReason, code: "DND35_SPELL_STATE_INCOMPLETE", spell: publicDnd35Spell(spell) });
        }
        if (!castPreflight.resolution?.legal) {
          return res.status(400).json({ message: `Cannot cast ${spell.name} from the character's current authoritative state.`, code: "DND35_SPELL_CAST_ILLEGAL", spell: publicDnd35Spell(spell), resolution: castPreflight.resolution });
        }
      }
    }

    const originalJson = res.json.bind(res);
    let reconciled = false;
    res.json = ((body: any) => {
      if (!reconciled && res.statusCode < 400) {
        reconciled = true;
        const completedTurn = !body?.duplicate && !body?.aiUnavailable && !body?.fallback && Boolean(body?.dmMessage);
        if (completedTurn) {
          const rewards = canonicalizeGrantedItems(campaign, character.id, beforeItemIds);
          if (rewards.length) body.rewardReconciliation = rewards;
          if (castPreflight?.spell && castPreflight.resolution?.legal) {
            const fresh = storage.getCharacter(character.id);
            if (fresh) consumeCharacterDnd35SpellUse(fresh, castPreflight.spell, castPreflight.resolution, storage);
            body.spellResolution = castPreflight.resolution;
            body.canonicalSpell = publicDnd35Spell(castPreflight.spell);
          }
        }
      }
      return originalJson(body);
    }) as typeof res.json;
    return next();
  });

  // Override level-up options only for D&D 3.5. Other rulesets continue into
  // the existing production handler unchanged. 3.5 has independent schedules:
  // +1 ability score every four levels and a general feat every three levels.
  app.get("/api/characters/:characterId/level-up-options", requireAuth, (req, res, next) => {
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return next();
    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign || campaign.ruleset !== "dnd35e") return next();
    if (!ownsCharacter(req, character)) return res.status(403).json({ message: "Not your character." });

    const xpLevel = levelForXp(character.xp, campaign.ruleset);
    if (xpLevel <= character.level) {
      return res.json({ eligible: false, ruleset: "dnd35e", classes: [], nextLevel: character.level, isAsiLevel: false, grantsAbilityIncrease: false, grantsFeat: false, abilityIncreasePoints: 0, conModifier: 0 });
    }

    const classes = character.charClass.split("/").map((part) => part.trim().replace(/\d+$/, "").trim()).filter(Boolean);
    const nextLevel = character.level + 1;
    const grantsAbilityIncrease = dnd35GrantsAbilityIncrease(nextLevel);
    const grantsFeat = dnd35GrantsFeat(nextLevel);
    return res.json({
      eligible: true,
      ruleset: "dnd35e",
      nextLevel,
      classes,
      isAsiLevel: grantsAbilityIncrease || grantsFeat,
      grantsAbilityIncrease,
      grantsFeat,
      abilityIncreasePoints: grantsAbilityIncrease ? 1 : 0,
      conModifier: abilityModifier(character.con),
      note: "D&D 3.5 ability increases and general feats are independent level benefits. Class bonus feats are handled separately as class progression is expanded.",
    });
  });

  // D&D 3.5 pre-handler. It validates canonical feat selection and the +1
  // ability increase schedule, then adapts the request to the legacy level-up
  // handler so existing HP/class/XP, achievement, message and websocket code
  // remains authoritative. The response wrapper corrects the temporary legacy
  // +2 ASI shape back to the actual +1 3.5 result and persists exact feat rules.
  app.post("/api/characters/:characterId/level-up", requireAuth, (req, res, next) => {
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return next();
    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign || campaign.ruleset !== "dnd35e") return next();
    if (!ownsCharacter(req, character)) return res.status(403).json({ message: "Not your character." });

    const xpLevel = levelForXp(character.xp, campaign.ruleset);
    if (xpLevel <= character.level) return next();
    const nextLevel = character.level + 1;
    const grantsFeat = dnd35GrantsFeat(nextLevel);
    const grantsAbilityIncrease = dnd35GrantsAbilityIncrease(nextLevel);

    const requestedFeat = typeof req.body?.featId === "string" && req.body.featId.trim()
      ? req.body.featId.trim()
      : typeof req.body?.feat === "string" ? req.body.feat.trim() : "";
    const ability = typeof req.body?.dnd35AbilityIncrease === "string" ? req.body.dnd35AbilityIncrease.trim().toLowerCase() : "";

    if (grantsFeat && !requestedFeat) {
      return res.status(400).json({ message: `Level ${nextLevel} grants a D&D 3.5 general feat. Choose an eligible feat from the Feat Codex.`, code: "DND35_FEAT_REQUIRED" });
    }
    if (!grantsFeat && requestedFeat) {
      return res.status(400).json({ message: `Level ${nextLevel} does not grant a general feat in D&D 3.5.`, code: "DND35_FEAT_NOT_GRANTED" });
    }
    if (grantsAbilityIncrease && !ABILITIES.has(ability)) {
      return res.status(400).json({ message: `Level ${nextLevel} grants +1 to one ability score. Choose Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma.`, code: "DND35_ABILITY_INCREASE_REQUIRED" });
    }
    if (!grantsAbilityIncrease && ability) {
      return res.status(400).json({ message: `Level ${nextLevel} does not grant an ability score increase in D&D 3.5.`, code: "DND35_ABILITY_INCREASE_NOT_GRANTED" });
    }

    let feat: Dnd35FeatDefinition | undefined;
    let parameters: Record<string, string | string[]> | undefined;
    if (grantsFeat) {
      feat = getDnd35Feat(requestedFeat);
      if (!feat) {
        return res.status(400).json({ message: "That feat is not present in the canonical D&D 3.5 feat corpus yet. DungeonMasterOS will not invent its prerequisites or effects.", code: "DND35_FEAT_NOT_CANONICAL" });
      }
      parameters = featParameterValues(req.body);
      const failures = [
        ...parameterErrors(feat, parameters),
        ...parameterSpecificPrerequisiteErrors(feat, parameters, character),
        ...evaluateCharacterForDnd35Feat(character, feat, storage).failures,
      ];
      if (sameRepeatSelection(feat, parameters, character)) failures.push(`${feat.name} has already been selected with the same parameters.`);
      if (failures.length) return res.status(400).json({ message: failures[0], code: "DND35_FEAT_PREREQUISITE_FAILED", failures });
      req.body.feat = feat.name;
      req.body.featId = feat.id;
      req.body.featParameters = parameters;
    }

    // The production handler only asks for an ASI at multiples of four and
    // currently expects 5e's +2 shape. Feed it a temporary +2 only when no feat
    // occupies that legacy choice slot; the response wrapper below restores the
    // exact 3.5 +1 result from the original pre-level character state.
    if (grantsAbilityIncrease && !grantsFeat) {
      req.body.asi = [{ ability, amount: 2 }];
    } else {
      delete req.body.asi;
    }

    const originalJson = res.json.bind(res);
    let finalized = false;
    res.json = ((body: any) => {
      if (!finalized && res.statusCode < 400 && body?.character?.id === characterId) {
        finalized = true;
        let fresh = storage.getCharacter(characterId);
        if (fresh && grantsAbilityIncrease) {
          const finalScore = Number((character as any)[ability]) + 1;
          const beforeModifier = ability === "con" ? abilityModifier(character.con) : 0;
          const afterModifier = ability === "con" ? abilityModifier(finalScore) : 0;
          const hpDelta = ability === "con" ? (afterModifier - beforeModifier) * nextLevel : 0;
          const abilityUpdate: any = { [ability]: finalScore };
          if (hpDelta !== 0) {
            abilityUpdate.maxHp = fresh.maxHp + hpDelta;
            abilityUpdate.hp = fresh.hp + hpDelta;
          }
          storage.updateCharacter(characterId, abilityUpdate);
          fresh = storage.getCharacter(characterId);
        }

        if (fresh && feat) {
          recordDnd35FeatSelection(fresh, feat, parameters, nextLevel, storage);
          const withCanonicalFeat = storage.getCharacter(characterId);
          if (withCanonicalFeat) ensureFeatInGenericCharacterData(withCanonicalFeat, feat);
          fresh = storage.getCharacter(characterId);
          body.canonicalFeat = publicDnd35Feat(feat);
        }

        body.character = fresh ?? body.character;
        body.dnd35LevelUp = {
          nextLevel,
          abilityIncrease: grantsAbilityIncrease ? { ability, amount: 1 } : null,
          feat: feat ? { id: feat.id, name: feat.name, parameters: parameters ?? {} } : null,
        };
      }
      return originalJson(body);
    }) as typeof res.json;

    return next();
  });
}
