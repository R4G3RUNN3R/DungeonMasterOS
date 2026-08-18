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
} from "./knowledge-library";
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

  // This guard is intentionally registered before server/routes.ts. It does not
  // perform the level-up itself; it prevents the legacy free-text feat path from
  // accepting an unknown or ineligible 3.5 feat, then lets the existing tested
  // level-up handler own HP/class/XP changes. On successful response it records
  // the exact canonical feat mechanics back into characterData.
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
