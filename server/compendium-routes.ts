import type { Express, Request } from "express";
import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.DATABASE_URL || path.resolve(process.cwd(), "data.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const PUBLISHED_WHERE = "publication_status != 'draft'";
const SOURCE_KINDS = new Set([
  "canonical_srd",
  "third_party_open",
  "voidsmith_homebrew",
  "campaign_homebrew",
]);

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function compactSourceTitle(row: any): string {
  const title = String(row.source_title || "");
  if (row.source_kind !== "canonical_srd") return title;
  return title
    .replace(/^D&D 5e\s*/i, "")
    .replace(/\s*-\s*(Equipment|Magic Items|Poisons)\s*$/i, "")
    .trim();
}

function publicDefinition(row: any) {
  return {
    id: Number(row.id),
    definitionKey: String(row.definition_key),
    ruleset: String(row.ruleset || ""),
    edition: String(row.edition || ""),
    name: String(row.name || ""),
    aliases: safeJson<string[]>(row.aliases_json, []),
    category: String(row.category || "misc"),
    subcategory: String(row.subcategory || ""),
    rarity: String(row.rarity || "Common"),
    attunement: Boolean(row.attunement),
    consumable: Boolean(row.consumable),
    equippable: Boolean(row.equippable),
    readable: Boolean(row.readable),
    viewable: Boolean(row.viewable),
    useAction: String(row.use_action || ""),
    equipSlots: safeJson<string[]>(row.equip_slots_json, []),
    description: String(row.description || ""),
    mechanics: safeJson<Record<string, unknown>>(row.mechanics_json, {}),
    effects: safeJson<Array<Record<string, unknown>>>(row.effects_json, []),
    actions: safeJson<string[]>(row.actions_json, []),
    tags: safeJson<string[]>(row.tags_json, []),
    costAmount: row.cost_amount == null ? null : Number(row.cost_amount),
    costCurrency: String(row.cost_currency || ""),
    weight: row.weight == null ? null : Number(row.weight),
    sourceKind: String(row.source_kind || ""),
    sourceTitle: compactSourceTitle(row),
    sourcePublisher: row.source_kind === "canonical_srd" ? "" : String(row.source_publisher || ""),
    sourceLicense: String(row.source_license || ""),
    sourceLicenseUrl: String(row.source_license_url || ""),
    sourceUrl: String(row.source_url || ""),
    sourceReference: String(row.source_reference || ""),
    sourceRecordId: String(row.source_record_id || ""),
    dataProvider: String(row.data_provider || ""),
    isHomebrew: Boolean(row.is_homebrew),
    featured: Boolean(row.featured),
  };
}

function stringParam(req: Request, key: string): string {
  const value = req.query[key];
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, Math.floor(parsed));
}

function facet(column: string) {
  return sqlite
    .prepare(
      `SELECT ${column} AS value, COUNT(*) AS count
       FROM item_definitions
       WHERE ${PUBLISHED_WHERE} AND ${column} != ''
       GROUP BY ${column}
       ORDER BY count DESC, value ASC`,
    )
    .all()
    .map((row: any) => ({ value: String(row.value), count: Number(row.count) }));
}

export function registerCompendiumRoutes(app: Express): void {
  app.get("/api/compendium/facets", (_req, res) => {
    const totals = sqlite
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END) AS featured,
          SUM(CASE WHEN source_kind = 'canonical_srd' THEN 1 ELSE 0 END) AS canonical,
          SUM(CASE WHEN is_homebrew = 1 THEN 1 ELSE 0 END) AS homebrew
         FROM item_definitions
         WHERE ${PUBLISHED_WHERE}`,
      )
      .get() as any;

    return res.json({
      total: Number(totals?.total || 0),
      featured: Number(totals?.featured || 0),
      canonical: Number(totals?.canonical || 0),
      homebrew: Number(totals?.homebrew || 0),
      categories: facet("category"),
      rarities: facet("rarity"),
      sourceKinds: facet("source_kind"),
      editions: facet("edition"),
      rulesets: facet("ruleset"),
    });
  });

  app.get("/api/compendium/items", (req, res) => {
    const q = stringParam(req, "q").toLowerCase();
    const category = stringParam(req, "category");
    const rarity = stringParam(req, "rarity");
    const edition = stringParam(req, "edition");
    const ruleset = stringParam(req, "ruleset");
    const sourceKind = stringParam(req, "source");
    const interaction = stringParam(req, "interaction");
    const featured = stringParam(req, "featured");
    const sort = stringParam(req, "sort") || "name";
    const page = positiveInt(req.query.page, 1, 100000);
    const pageSize = positiveInt(req.query.pageSize, 24, 60);

    const where = [PUBLISHED_WHERE];
    const args: Array<string | number> = [];

    if (q) {
      const like = `%${q}%`;
      where.push(
        "(lower(name) LIKE ? OR normalized_name LIKE ? OR lower(description) LIKE ? OR lower(aliases_json) LIKE ? OR lower(tags_json) LIKE ?)",
      );
      args.push(like, like, like, like, like);
    }
    if (category) {
      where.push("category = ?");
      args.push(category);
    }
    if (rarity) {
      where.push("rarity = ?");
      args.push(rarity);
    }
    if (edition) {
      where.push("edition = ?");
      args.push(edition);
    }
    if (ruleset) {
      where.push("ruleset = ?");
      args.push(ruleset);
    }
    if (sourceKind && SOURCE_KINDS.has(sourceKind)) {
      where.push("source_kind = ?");
      args.push(sourceKind);
    }
    if (featured === "true") where.push("featured = 1");

    if (interaction === "equip") where.push("equippable = 1");
    if (interaction === "use") where.push("actions_json LIKE '%\"use\"%'");
    if (interaction === "read") where.push("readable = 1");
    if (interaction === "view") where.push("viewable = 1");

    const rarityOrder = `CASE rarity
      WHEN 'Common' THEN 1
      WHEN 'Uncommon' THEN 2
      WHEN 'Rare' THEN 3
      WHEN 'Very Rare' THEN 4
      WHEN 'Legendary' THEN 5
      WHEN 'Artifact' THEN 6
      ELSE 7 END`;

    const orderBy =
      sort === "rarity"
        ? `${rarityOrder} ASC, name ASC`
        : sort === "rarity-desc"
          ? `${rarityOrder} DESC, name ASC`
          : sort === "category"
            ? "category ASC, subcategory ASC, name ASC"
            : sort === "source"
              ? "source_kind ASC, source_title ASC, name ASC"
              : "name ASC";

    const whereSql = where.join(" AND ");
    const total = Number(
      (sqlite.prepare(`SELECT COUNT(*) AS count FROM item_definitions WHERE ${whereSql}`).get(...args) as any)?.count || 0,
    );
    const offset = (page - 1) * pageSize;
    const rows = sqlite
      .prepare(
        `SELECT * FROM item_definitions
         WHERE ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset) as any[];

    return res.json({
      items: rows.map(publicDefinition),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  });

  app.get("/api/compendium/items/:definitionKey", (req, res) => {
    const definitionKey = decodeURIComponent(String(req.params.definitionKey || ""));
    const row = sqlite
      .prepare(`SELECT * FROM item_definitions WHERE definition_key = ? AND ${PUBLISHED_WHERE}`)
      .get(definitionKey) as any;
    if (!row) return res.status(404).json({ message: "Compendium item not found" });
    return res.json(publicDefinition(row));
  });
}
