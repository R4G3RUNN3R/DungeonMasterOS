import type { Express, Request } from "express";
import type { Dnd35ItemCategory, Dnd35ItemDefinition } from "@shared/dnd35-rules/items";
import { DND35_SOURCE_MANIFEST } from "@shared/dnd35-rules/sources";
import { getDnd35Item, getDnd35ItemLibraryStatus, listDnd35Items } from "./dnd35-item-library";

const sourceById = new Map(DND35_SOURCE_MANIFEST.map((source) => [source.id, source]));
const CATEGORIES = new Set<Dnd35ItemCategory>([
  "weapon", "armor", "shield", "ammunition", "gear", "tool", "potion", "oil", "scroll", "wand", "staff", "ring", "rod", "wondrous", "magic-weapon", "magic-armor", "cursed", "artifact", "other",
]);

function stringQuery(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value.trim() : "";
}

function publicItem(item: Dnd35ItemDefinition) {
  return {
    ...item,
    sources: item.sources.map((source) => ({
      ...source,
      title: sourceById.get(source.sourceId)?.title ?? source.sourceId,
      abbreviation: sourceById.get(source.sourceId)?.abbreviation ?? source.sourceId,
      privateReference: source.sourceKind === "official-book-private-reference",
      url: source.sourceKind === "official-book-private-reference" ? undefined : source.url,
    })),
  };
}

export function registerDnd35ItemRoutes(app: Express) {
  app.get("/api/knowledge/dnd35/items", (req, res) => {
    const categoryText = stringQuery(req, "category");
    const category = categoryText && CATEGORIES.has(categoryText as Dnd35ItemCategory)
      ? categoryText as Dnd35ItemCategory
      : undefined;
    if (categoryText && !category) return res.status(400).json({ message: "Unknown D&D 3.5 item category." });
    const status = getDnd35ItemLibraryStatus();
    return res.json({
      edition: "3.5e",
      corpusStatus: status.corpusStatus,
      sourceRevision: status.sourceRevision,
      items: listDnd35Items({ category, query: stringQuery(req, "q") || undefined }).map(publicItem),
    });
  });

  app.get("/api/knowledge/dnd35/items/:id", (req, res) => {
    const item = getDnd35Item(String(req.params.id || ""));
    if (!item) return res.status(404).json({ message: "Item is not present in the loaded canonical D&D 3.5 item corpus." });
    return res.json(publicItem(item));
  });
}
