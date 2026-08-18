import type { Express, Request } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
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
      // Absence from the corpus must remain visible. This can still be a valid
      // campaign/homebrew reward, but it is not allowed to masquerade as a
      // canonical rulebook item until that edition's item corpus contains it.
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

export function registerKnowledgeRoutes(app: Express): void {
  app.get("/api/knowledge/library", (_req, res) => {
    return res.json({ title: "The Library of Knowledge", shelves: getKnowledgeShelves() });
  });

  app.get("/api/knowledge/dnd35/spells", (req, res) => {
    const tradition = stringQuery(req, "tradition");
    if (tradition && tradition !== "arcane" && tradition !== "divine" && tradition !== "other") {
      return res.status(400).json({ message: "Unknown spell tradition." });
    }
    return res.json({
      edition: "3.5e",
      corpusStatus: "foundation",
      spells: listPublicDnd35Spells({ tradition: tradition as any || undefined, query: stringQuery(req, "q") || undefined }),
    });
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
    return res.json({
      edition: "3.5e",
      corpusStatus: "foundation",
      feats: listPublicDnd35Feats({ category, query: stringQuery(req, "q") || undefined }),
    });
  });

  app.get("/api/knowledge/dnd35/feats/:id", (req, res) => {
    const feat = getDnd35Feat(String(req.params.id || ""));
    if (!feat) return res.status(404).json({ message: "Feat is not yet present in the canonical 3.5 corpus." });
    return res.json(publicDnd35Feat(feat));
  });

  app.get("/api/knowledge/dnd35/characters/:characterId/eligible-feats", requireAuth, (req, res) => {
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found." });
    if (!canReadCharacter(req, character)) return res.status(403).json({ message: "Not your character." });
    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign || campaign.ruleset !== "dnd35e") return res.status(400).json({ message: "This character is not in a D&D 3.5e campaign." });

    const selected = readStoredDnd35FeatSelections(character);
    const feats = listPublicDnd35Feats({}).map((feat: any) => {
      const canonical = getDnd35Feat(feat.id)!;
      const qualification = evaluateCharacterForDnd35Feat(character, canonical, storage);
      return {
        ...feat,
        selected: selected.some((entry) => entry.featId === feat.id),
        qualified: qualification.qualified,
        failures: qualification.failures,
      };
    });
    return res.json({ edition: "3.5e", feats });
  });

  // Registered before the normal campaign action route. For canonical spells
  // already present in the 3.5 corpus, this turns a player cast into a real
  // rules preflight against their persisted spellcasting state. The legacy AI
  // narration route only runs if the cast is legal, and spell resources are
  // consumed only after that route successfully completes the turn.
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
        castPreflight = resolveCharacterDnd35SpellCast(
          character,
          spell,
          text,
          storage.getItemsByCharacter(character.id),
          storage.getActiveEffectsByCharacter(character.id),
        );
        if (castPreflight.unavailableReason) {
          return res.status(409).json({
            message: castPreflight.unavailableReason,
            code: "DND35_SPELL_STATE_INCOMPLETE",
            spell: publicDnd35Spell(spell),
          });
        }
        if (!castPreflight.resolution?.legal) {
          return res.status(400).json({
            message: `Cannot cast ${spell.name} from the character's current authoritative state.`,
            code: "DND35_SPELL_CAST_ILLEGAL",
            spell: publicDnd35Spell(spell),
            resolution: castPreflight.resolution,
          });
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

  // Narrow canonical feat guard in front of the legacy level-up handler.
  // It validates and persists exact feat mechanics, but the legacy level-up
  // route still needs its 3.5 feat/ability-increase scheduling refactored
  // before this can be considered the final 3.5 level progression workflow.
  app.post("/api/characters/:characterId/level-up", requireAuth, (req, res, next) => {
    const requested = typeof req.body?.featId === "string" && req.body.featId.trim()
      ? req.body.featId.trim()
      : typeof req.body?.feat === "string" ? req.body.feat.trim() : "";
    if (!requested) return next();

    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return next();
    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign || campaign.ruleset !== "dnd35e") return next();
    if (!canReadCharacter(req, character)) return res.status(403).json({ message: "Not your character." });

    const feat = getDnd35Feat(requested);
    if (!feat) {
      return res.status(400).json({
        message: "That feat is not present in the canonical D&D 3.5 feat corpus yet. DungeonMasterOS will not invent its prerequisites or effects.",
        code: "DND35_FEAT_NOT_CANONICAL",
      });
    }

    const parameters = featParameterValues(req.body);
    const failures = [
      ...parameterErrors(feat, parameters),
      ...parameterSpecificPrerequisiteErrors(feat, parameters, character),
      ...evaluateCharacterForDnd35Feat(character, feat, storage).failures,
    ];
    if (sameRepeatSelection(feat, parameters, character)) failures.push(`${feat.name} has already been selected with the same parameters.`);
    if (failures.length) {
      return res.status(400).json({ message: failures[0], code: "DND35_FEAT_PREREQUISITE_FAILED", failures });
    }

    req.body.feat = feat.name;
    req.body.featId = feat.id;
    req.body.featParameters = parameters;

    const originalJson = res.json.bind(res);
    let recorded = false;
    res.json = ((body: any) => {
      if (!recorded && res.statusCode < 400 && body?.character?.id === characterId) {
        recorded = true;
        const fresh = storage.getCharacter(characterId);
        if (fresh) {
          recordDnd35FeatSelection(fresh, feat, parameters, fresh.level, storage);
          body.character = storage.getCharacter(characterId) ?? body.character;
          body.canonicalFeat = publicDnd35Feat(feat);
        }
      }
      return originalJson(body);
    }) as typeof res.json;

    return next();
  });
}
