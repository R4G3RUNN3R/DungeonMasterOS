import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.DATABASE_URL || path.resolve(process.cwd(), "data.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export type CompendiumSourceKind =
  | "canonical_srd"
  | "third_party_open"
  | "voidsmith_homebrew"
  | "campaign_homebrew";

export interface ItemDefinitionRecord {
  definitionKey: string;
  ruleset: string;
  edition: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  category: string;
  subcategory: string;
  rarity: string;
  attunement: boolean;
  consumable: boolean;
  equippable: boolean;
  readable: boolean;
  viewable: boolean;
  useAction: string;
  equipSlots: string[];
  description: string;
  mechanics: Record<string, unknown>;
  effects: Array<Record<string, unknown>>;
  actions: string[];
  tags: string[];
  costAmount: number | null;
  costCurrency: string;
  weight: number | null;
  sourceKind: CompendiumSourceKind;
  sourceTitle: string;
  sourcePublisher: string;
  sourceLicense: string;
  sourceLicenseUrl: string;
  sourceUrl: string;
  sourceReference: string;
  sourceRecordId: string;
  dataProvider: string;
  isHomebrew: boolean;
  publicationStatus: "published" | "generated_core" | "draft";
  featured: boolean;
}

interface RemoteSrdSource {
  id: string;
  ruleset: string;
  edition: string;
  kind: "equipment" | "magic" | "poison";
  sourceTitle: string;
  sourceUrl: string;
  dataUrl: string;
}

const CC_BY_4_URL = "https://creativecommons.org/licenses/by/4.0/";
const OFFICIAL_SRD_URL = "https://www.dndbeyond.com/srd";
const FIVE_E_BITS = "https://github.com/5e-bits/5e-database";

const SRD_SOURCES: RemoteSrdSource[] = [
  {
    id: "srd-2014-equipment",
    ruleset: "dnd5e",
    edition: "2014",
    kind: "equipment",
    sourceTitle: "D&D 5e SRD 5.1 (2014) - Equipment",
    sourceUrl: OFFICIAL_SRD_URL,
    dataUrl: "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-Equipment.json",
  },
  {
    id: "srd-2014-magic-items",
    ruleset: "dnd5e",
    edition: "2014",
    kind: "magic",
    sourceTitle: "D&D 5e SRD 5.1 (2014) - Magic Items",
    sourceUrl: OFFICIAL_SRD_URL,
    dataUrl: "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-Magic-Items.json",
  },
  {
    id: "srd-2024-equipment",
    ruleset: "dnd5e",
    edition: "2024",
    kind: "equipment",
    sourceTitle: "D&D 5e SRD 5.2.1 (2024 rules) - Equipment",
    sourceUrl: OFFICIAL_SRD_URL,
    dataUrl: "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Equipment.json",
  },
  {
    id: "srd-2024-magic-items",
    ruleset: "dnd5e",
    edition: "2024",
    kind: "magic",
    sourceTitle: "D&D 5e SRD 5.2.1 (2024 rules) - Magic Items",
    sourceUrl: OFFICIAL_SRD_URL,
    dataUrl: "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Magic-Items.json",
  },
  {
    id: "srd-2024-poisons",
    ruleset: "dnd5e",
    edition: "2024",
    kind: "poison",
    sourceTitle: "D&D 5e SRD 5.2.1 (2024 rules) - Poisons",
    sourceUrl: OFFICIAL_SRD_URL,
    dataUrl: "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Poisons.json",
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9+' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function tableHasColumn(table: string, column: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  if (!tableHasColumn(table, column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function ensureCompendiumSchema(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS item_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      definition_key TEXT NOT NULL UNIQUE,
      ruleset TEXT NOT NULL DEFAULT 'dnd5e',
      edition TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      aliases_json TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT 'misc',
      subcategory TEXT NOT NULL DEFAULT '',
      rarity TEXT NOT NULL DEFAULT 'Common',
      attunement INTEGER NOT NULL DEFAULT 0,
      consumable INTEGER NOT NULL DEFAULT 0,
      equippable INTEGER NOT NULL DEFAULT 0,
      readable INTEGER NOT NULL DEFAULT 0,
      viewable INTEGER NOT NULL DEFAULT 0,
      use_action TEXT NOT NULL DEFAULT '',
      equip_slots_json TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      mechanics_json TEXT NOT NULL DEFAULT '{}',
      effects_json TEXT NOT NULL DEFAULT '[]',
      actions_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      cost_amount REAL,
      cost_currency TEXT NOT NULL DEFAULT '',
      weight REAL,
      source_kind TEXT NOT NULL,
      source_title TEXT NOT NULL,
      source_publisher TEXT NOT NULL DEFAULT '',
      source_license TEXT NOT NULL DEFAULT '',
      source_license_url TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      source_reference TEXT NOT NULL DEFAULT '',
      source_record_id TEXT NOT NULL DEFAULT '',
      data_provider TEXT NOT NULL DEFAULT '',
      is_homebrew INTEGER NOT NULL DEFAULT 0,
      publication_status TEXT NOT NULL DEFAULT 'published',
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_item_definitions_name
      ON item_definitions(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_item_definitions_category
      ON item_definitions(category, subcategory);
    CREATE INDEX IF NOT EXISTS idx_item_definitions_source
      ON item_definitions(source_kind, edition);
    CREATE INDEX IF NOT EXISTS idx_item_definitions_rarity
      ON item_definitions(rarity);

    CREATE TABLE IF NOT EXISTS item_definition_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      definition_key TEXT NOT NULL,
      alias TEXT NOT NULL,
      normalized_alias TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      UNIQUE(definition_key, normalized_alias)
    );

    CREATE INDEX IF NOT EXISTS idx_item_alias_normalized
      ON item_definition_aliases(normalized_alias);

    CREATE TABLE IF NOT EXISTS compendium_sync_state (
      source_id TEXT PRIMARY KEY,
      last_attempt_at TEXT,
      last_success_at TEXT,
      imported_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT ''
    );
  `);

  // These links are intentionally nullable. Existing inventory/shop rows remain valid.
  addColumnIfMissing("items", "definition_key", "TEXT");
  addColumnIfMissing("shop_items", "definition_key", "TEXT");

  // FTS5 is available in normal SQLite builds, but gameplay must not depend on it.
  try {
    sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS item_definitions_fts USING fts5(
        definition_key UNINDEXED,
        name,
        aliases,
        description,
        tags
      );
    `);
  } catch {
    // Graceful fallback to indexed LIKE lookups.
  }
}

const upsertDefinition = sqlite.prepare(`
  INSERT INTO item_definitions (
    definition_key, ruleset, edition, name, normalized_name, aliases_json,
    category, subcategory, rarity, attunement, consumable, equippable,
    readable, viewable, use_action, equip_slots_json, description,
    mechanics_json, effects_json, actions_json, tags_json, cost_amount,
    cost_currency, weight, source_kind, source_title, source_publisher,
    source_license, source_license_url, source_url, source_reference,
    source_record_id, data_provider, is_homebrew, publication_status, featured,
    updated_at
  ) VALUES (
    @definitionKey, @ruleset, @edition, @name, @normalizedName, @aliasesJson,
    @category, @subcategory, @rarity, @attunement, @consumable, @equippable,
    @readable, @viewable, @useAction, @equipSlotsJson, @description,
    @mechanicsJson, @effectsJson, @actionsJson, @tagsJson, @costAmount,
    @costCurrency, @weight, @sourceKind, @sourceTitle, @sourcePublisher,
    @sourceLicense, @sourceLicenseUrl, @sourceUrl, @sourceReference,
    @sourceRecordId, @dataProvider, @isHomebrew, @publicationStatus, @featured,
    datetime('now')
  )
  ON CONFLICT(definition_key) DO UPDATE SET
    name = excluded.name,
    normalized_name = excluded.normalized_name,
    aliases_json = excluded.aliases_json,
    category = excluded.category,
    subcategory = excluded.subcategory,
    rarity = excluded.rarity,
    attunement = excluded.attunement,
    consumable = excluded.consumable,
    equippable = excluded.equippable,
    readable = excluded.readable,
    viewable = excluded.viewable,
    use_action = excluded.use_action,
    equip_slots_json = excluded.equip_slots_json,
    description = excluded.description,
    mechanics_json = excluded.mechanics_json,
    effects_json = excluded.effects_json,
    actions_json = excluded.actions_json,
    tags_json = excluded.tags_json,
    cost_amount = excluded.cost_amount,
    cost_currency = excluded.cost_currency,
    weight = excluded.weight,
    source_title = excluded.source_title,
    source_publisher = excluded.source_publisher,
    source_license = excluded.source_license,
    source_license_url = excluded.source_license_url,
    source_url = excluded.source_url,
    source_reference = excluded.source_reference,
    source_record_id = excluded.source_record_id,
    data_provider = excluded.data_provider,
    publication_status = excluded.publication_status,
    featured = excluded.featured,
    updated_at = datetime('now')
`);

const deleteAliases = sqlite.prepare(
  "DELETE FROM item_definition_aliases WHERE definition_key = ?",
);
const insertAlias = sqlite.prepare(`
  INSERT OR IGNORE INTO item_definition_aliases
    (definition_key, alias, normalized_alias, priority)
  VALUES (?, ?, ?, ?)
`);

function writeDefinition(record: ItemDefinitionRecord): void {
  upsertDefinition.run({
    ...record,
    aliasesJson: json(record.aliases),
    attunement: record.attunement ? 1 : 0,
    consumable: record.consumable ? 1 : 0,
    equippable: record.equippable ? 1 : 0,
    readable: record.readable ? 1 : 0,
    viewable: record.viewable ? 1 : 0,
    equipSlotsJson: json(record.equipSlots),
    mechanicsJson: json(record.mechanics),
    effectsJson: json(record.effects),
    actionsJson: json(record.actions),
    tagsJson: json(record.tags),
    isHomebrew: record.isHomebrew ? 1 : 0,
    featured: record.featured ? 1 : 0,
  });

  deleteAliases.run(record.definitionKey);
  const aliases = Array.from(new Set([record.name, ...record.aliases]));
  aliases.forEach((alias, index) => {
    const normalized = normalizeName(alias);
    if (normalized) insertAlias.run(record.definitionKey, alias, normalized, 100 - index);
  });

  try {
    sqlite.prepare("DELETE FROM item_definitions_fts WHERE definition_key = ?").run(record.definitionKey);
    sqlite
      .prepare(
        "INSERT INTO item_definitions_fts(definition_key, name, aliases, description, tags) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        record.definitionKey,
        record.name,
        record.aliases.join(" "),
        record.description,
        record.tags.join(" "),
      );
  } catch {
    // FTS is optional.
  }
}

function categoryInfo(raw: any, kind: RemoteSrdSource["kind"]) {
  if (kind === "poison") {
    return { category: "consumable", subcategory: "poison" };
  }

  const categoryNames = [
    raw?.equipment_category?.name,
    ...(Array.isArray(raw?.equipment_categories)
      ? raw.equipment_categories.map((x: any) => x?.name)
      : []),
    raw?.gear_category?.name,
    raw?.weapon_category,
    raw?.armor_category,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  const joined = categoryNames.join(" ");

  if (/weapon|ammunition/.test(joined)) return { category: "weapon", subcategory: raw?.weapon_category || "" };
  if (/armor|armour|shield/.test(joined)) return { category: "armor", subcategory: raw?.armor_category || "" };
  if (/tool|instrument|gaming set|artisan/.test(joined)) return { category: "tool", subcategory: categoryNames[0] || "" };
  if (kind === "magic") return { category: "magic", subcategory: raw?.equipment_category?.name || "" };
  return { category: "gear", subcategory: categoryNames[0] || "" };
}

function descriptionFrom(raw: any): string {
  if (typeof raw?.description === "string") return raw.description.trim();
  if (typeof raw?.desc === "string") return raw.desc.replace(/\s*\\n\s*/g, "\n").trim();
  if (Array.isArray(raw?.desc)) return raw.desc.join("\n").trim();
  return "";
}

function inferInteractionFlags(name: string, category: string, description: string, raw: any) {
  const haystack = `${name} ${category} ${description}`.toLowerCase();
  const consumable =
    category === "consumable" ||
    /potion|poison|elixir|oil|acid|alchemist.?s fire|antitoxin|ration|food|drink|ammunition/.test(haystack) ||
    raw?.consumable === true;
  const equippable = category === "weapon" || category === "armor" || /ring|amulet|cloak|boots|gloves|helm|hat|belt|bracers|goggles/.test(haystack);
  const readable = /book|scroll|map|letter|notice|note|journal|tome|manual|paper|parchment|deed|writ|contract|chart/.test(haystack);
  const viewable = readable || /map|painting|portrait|diagram|blueprint|schematic|chart/.test(haystack);
  const actions = new Set<string>(["inspect"]);
  if (equippable) actions.add("equip");
  if (consumable || /activate|command word|charges|use this/.test(haystack)) actions.add("use");
  if (readable) actions.add("read");
  if (viewable) actions.add("view");

  let equipSlots: string[] = [];
  if (category === "weapon") equipSlots = ["main_hand", "off_hand"];
  if (category === "armor") equipSlots = /shield/.test(haystack) ? ["off_hand"] : ["chest"];
  if (/ring/.test(haystack)) equipSlots = ["ring"];
  if (/boots/.test(haystack)) equipSlots = ["feet"];
  if (/gloves|gauntlet/.test(haystack)) equipSlots = ["hands"];
  if (/cloak|cape/.test(haystack)) equipSlots = ["back"];
  if (/helm|helmet|hat|circlet/.test(haystack)) equipSlots = ["head"];
  if (/belt/.test(haystack)) equipSlots = ["waist"];
  if (/amulet|necklace|periapt|medallion/.test(haystack)) equipSlots = ["neck"];
  if (/bracers/.test(haystack)) equipSlots = ["wrists"];

  return { consumable, equippable, readable, viewable, actions: [...actions], equipSlots };
}

function normalizeSrdRecord(source: RemoteSrdSource, raw: any): ItemDefinitionRecord | null {
  const name = String(raw?.name || "").trim();
  if (!name) return null;
  const recordId = String(raw?.index || slugify(name));
  const description = descriptionFrom(raw);
  const { category, subcategory } = categoryInfo(raw, source.kind);
  const flags = inferInteractionFlags(name, category, description, raw);
  const rarity = String(raw?.rarity?.name || raw?.rarity || (source.kind === "magic" ? "Varies" : "Common"));
  const cost = raw?.cost && typeof raw.cost === "object" ? raw.cost : null;
  const tags = Array.from(
    new Set(
      [
        "dnd5e",
        `edition:${source.edition}`,
        source.kind,
        category,
        subcategory,
        rarity !== "Common" ? `rarity:${rarity.toLowerCase()}` : "",
        raw?.weapon_category,
        raw?.armor_category,
        ...(Array.isArray(raw?.properties) ? raw.properties.map((p: any) => p?.name) : []),
      ]
        .filter(Boolean)
        .map((x) => String(x)),
    ),
  );

  return {
    definitionKey: `dnd5e-${source.edition}:${recordId}`,
    ruleset: source.ruleset,
    edition: source.edition,
    name,
    normalizedName: normalizeName(name),
    aliases: [],
    category,
    subcategory: String(subcategory || ""),
    rarity,
    attunement: Boolean(raw?.attunement),
    consumable: flags.consumable,
    equippable: flags.equippable,
    readable: flags.readable,
    viewable: flags.viewable,
    useAction: flags.actions.includes("use") ? "use" : "",
    equipSlots: flags.equipSlots,
    description,
    mechanics: raw,
    effects: [],
    actions: flags.actions,
    tags,
    costAmount: Number.isFinite(Number(cost?.quantity)) ? Number(cost.quantity) : null,
    costCurrency: cost?.unit ? String(cost.unit) : "",
    weight: Number.isFinite(Number(raw?.weight)) ? Number(raw.weight) : null,
    sourceKind: "canonical_srd",
    sourceTitle: source.sourceTitle,
    sourcePublisher: "Wizards of the Coast",
    sourceLicense: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    sourceLicenseUrl: CC_BY_4_URL,
    sourceUrl: source.sourceUrl,
    sourceReference: source.dataUrl,
    sourceRecordId: recordId,
    dataProvider: "5e-bits / 5e-database",
    isHomebrew: false,
    publicationStatus: "published",
    featured: false,
  };
}

async function fetchJson(url: string): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "DungeonMasterOS-Compendium/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const parsed = await response.json();
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function importSrdSource(source: RemoteSrdSource): Promise<number> {
  sqlite
    .prepare(`
      INSERT INTO compendium_sync_state(source_id, last_attempt_at)
      VALUES (?, datetime('now'))
      ON CONFLICT(source_id) DO UPDATE SET last_attempt_at = datetime('now')
    `)
    .run(source.id);

  try {
    const rows = await fetchJson(source.dataUrl);
    let imported = 0;
    const transaction = sqlite.transaction(() => {
      for (const raw of rows) {
        const record = normalizeSrdRecord(source, raw);
        if (!record) continue;
        writeDefinition(record);
        imported++;
      }
    });
    transaction();

    sqlite
      .prepare(`
        UPDATE compendium_sync_state
        SET last_success_at = datetime('now'), imported_count = ?, last_error = ''
        WHERE source_id = ?
      `)
      .run(imported, source.id);
    return imported;
  } catch (error: any) {
    sqlite
      .prepare(`
        UPDATE compendium_sync_state
        SET last_error = ?
        WHERE source_id = ?
      `)
      .run(String(error?.message || error).slice(0, 1000), source.id);
    throw error;
  }
}

const HOMEBREW_RARITIES = [
  { rarity: "Common", bonus: 0, die: "1d4", value: 50 },
  { rarity: "Uncommon", bonus: 1, die: "1d6", value: 250 },
  { rarity: "Rare", bonus: 1, die: "1d8", value: 2500 },
  { rarity: "Very Rare", bonus: 2, die: "1d10", value: 15000 },
  { rarity: "Legendary", bonus: 3, die: "2d6", value: 75000 },
] as const;

const WEAPON_BASES = [
  ["Dagger", "1d4", "piercing", "Finesse, Light, Thrown"],
  ["Shortsword", "1d6", "piercing", "Finesse, Light"],
  ["Longsword", "1d8", "slashing", "Versatile"],
  ["Rapier", "1d8", "piercing", "Finesse"],
  ["Scimitar", "1d6", "slashing", "Finesse, Light"],
  ["Battleaxe", "1d8", "slashing", "Versatile"],
  ["Warhammer", "1d8", "bludgeoning", "Versatile"],
  ["Morningstar", "1d8", "piercing", ""],
  ["Greataxe", "1d12", "slashing", "Heavy, Two-Handed"],
  ["Greatsword", "2d6", "slashing", "Heavy, Two-Handed"],
  ["Maul", "2d6", "bludgeoning", "Heavy, Two-Handed"],
  ["Glaive", "1d10", "slashing", "Heavy, Reach, Two-Handed"],
  ["Spear", "1d6", "piercing", "Thrown, Versatile"],
  ["Quarterstaff", "1d6", "bludgeoning", "Versatile"],
  ["Longbow", "1d8", "piercing", "Ammunition, Heavy, Two-Handed"],
  ["Hand Crossbow", "1d6", "piercing", "Ammunition, Light, Loading"],
] as const;

const THEMES = [
  ["Ashen", "fire", "embers crawl along its surface when danger is near"],
  ["Frostbound", "cold", "a rim of harmless frost gathers along its edges"],
  ["Stormforged", "lightning", "the air around it prickles before a strike"],
  ["Graveglass", "necrotic", "its dark sheen swallows nearby reflections"],
  ["Dawnlit", "radiant", "warm gold light gathers around engraved runes"],
  ["Venomwake", "poison", "green filaments shift beneath the material"],
  ["Mindspike", "psychic", "a faint pressure builds behind the eyes nearby"],
  ["Thundering", "thunder", "it hums with a note felt more than heard"],
  ["Starfall", "radiant", "pinpricks of pale light drift across its surface"],
  ["Deepstone", "force", "it feels unnaturally solid in the hand"],
  ["Umbral", "necrotic", "its outline seems darker than the room around it"],
  ["Verdant", "poison", "living vine motifs slowly rearrange themselves"],
  ["Tideborn", "cold", "tiny droplets bead on it even in dry air"],
  ["Emberwake", "fire", "it sheds brief sparks after sudden movement"],
  ["Skybreaker", "lightning", "distant thunder answers particularly hard blows"],
  ["Moonveil", "psychic", "silver markings brighten beneath moonlight"],
] as const;

const ARMOR_BASES = [
  ["Leather Armor", 11, "light"],
  ["Studded Leather", 12, "light"],
  ["Hide Armor", 12, "medium"],
  ["Chain Shirt", 13, "medium"],
  ["Scale Mail", 14, "medium"],
  ["Breastplate", 14, "medium"],
  ["Half Plate", 15, "medium"],
  ["Ring Mail", 14, "heavy"],
  ["Chain Mail", 16, "heavy"],
  ["Splint Armor", 17, "heavy"],
  ["Plate Armor", 18, "heavy"],
  ["Shield", 2, "shield"],
] as const;

const WONDROUS_FORMS = [
  "Amulet", "Belt", "Boots", "Bracers", "Brooch", "Circlet", "Cloak", "Gloves",
  "Goggles", "Lantern", "Lens", "Mask", "Medallion", "Orb", "Ring", "Rod",
  "Talisman", "Token", "Wand", "Waystone",
] as const;

const CONSUMABLE_FORMS = [
  "Draught", "Elixir", "Incense", "Oil", "Phial", "Potion", "Powder", "Salve",
  "Smoke Pellet", "Tonic",
] as const;

function homebrewSource(overrides: Partial<ItemDefinitionRecord>): ItemDefinitionRecord {
  const name = overrides.name || "Unnamed Relic";
  return {
    definitionKey: overrides.definitionKey || `dmos:${slugify(name)}`,
    ruleset: "dnd5e",
    edition: "compatible",
    name,
    normalizedName: normalizeName(name),
    aliases: overrides.aliases || [],
    category: overrides.category || "magic",
    subcategory: overrides.subcategory || "wondrous",
    rarity: overrides.rarity || "Uncommon",
    attunement: overrides.attunement ?? false,
    consumable: overrides.consumable ?? false,
    equippable: overrides.equippable ?? false,
    readable: overrides.readable ?? false,
    viewable: overrides.viewable ?? false,
    useAction: overrides.useAction || "",
    equipSlots: overrides.equipSlots || [],
    description: overrides.description || "",
    mechanics: overrides.mechanics || {},
    effects: overrides.effects || [],
    actions: overrides.actions || ["inspect"],
    tags: overrides.tags || ["dnd5e", "homebrew", "dungeonmasteros"],
    costAmount: overrides.costAmount ?? null,
    costCurrency: overrides.costCurrency || "gp",
    weight: overrides.weight ?? null,
    sourceKind: "voidsmith_homebrew",
    sourceTitle: "DungeonMasterOS Core Homebrew Compendium",
    sourcePublisher: "Voidsmith Industries",
    sourceLicense: "First-party DungeonMasterOS content",
    sourceLicenseUrl: "",
    sourceUrl: "https://www.dungeonmaster-os.com",
    sourceReference: "DungeonMasterOS master item compendium",
    sourceRecordId: overrides.sourceRecordId || slugify(name),
    dataProvider: "DungeonMasterOS",
    isHomebrew: true,
    publicationStatus: overrides.publicationStatus || "generated_core",
    featured: overrides.featured ?? false,
  };
}

function generateHomebrewDefinitions(): ItemDefinitionRecord[] {
  const definitions: ItemDefinitionRecord[] = [];

  // 1,280 themed weapons: 16 bases x 16 themes x 5 rarities.
  for (const [baseName, baseDamage, physicalType, properties] of WEAPON_BASES) {
    for (const [themeName, energyType, visual] of THEMES) {
      for (const tier of HOMEBREW_RARITIES) {
        const name = `${themeName} ${baseName}`;
        const key = `dmos:weapon:${slugify(themeName)}:${slugify(baseName)}:${slugify(tier.rarity)}`;
        const bonusText = tier.bonus > 0 ? ` You gain a +${tier.bonus} bonus to attack and damage rolls made with it.` : "";
        definitions.push(
          homebrewSource({
            definitionKey: key,
            name: tier.rarity === "Common" ? name : `${name} (${tier.rarity})`,
            aliases: [name, `${themeName} ${baseName.toLowerCase()}`],
            category: "weapon",
            subcategory: "magic weapon",
            rarity: tier.rarity,
            attunement: tier.rarity === "Very Rare" || tier.rarity === "Legendary",
            equippable: true,
            equipSlots: ["main_hand", "off_hand"],
            description: `A ${baseName.toLowerCase()} shaped by ${themeName.toLowerCase()} magic; ${visual}.${bonusText} Once on each of your turns when you hit with it, the weapon deals an extra ${tier.die} ${energyType} damage.`,
            mechanics: {
              baseItem: baseName,
              baseDamage,
              physicalDamageType: physicalType,
              properties,
              attackBonus: tier.bonus,
              damageBonus: tier.bonus,
              extraDamage: tier.die,
              extraDamageType: energyType,
              frequency: "once_per_turn",
            },
            effects: [{ type: "extra_damage", dice: tier.die, damageType: energyType, frequency: "once_per_turn" }],
            actions: ["inspect", "equip"],
            tags: ["dnd5e", "homebrew", "weapon", themeName.toLowerCase(), energyType, tier.rarity.toLowerCase()],
            costAmount: tier.value,
            costCurrency: "gp",
          }),
        );
      }
    }
  }

  // 360 themed armor pieces: 12 bases x 6 themes x 5 rarities.
  for (const [baseName, baseAc, armorClass] of ARMOR_BASES) {
    for (const [themeName, energyType, visual] of THEMES.slice(0, 6)) {
      for (const tier of HOMEBREW_RARITIES) {
        const name = `${themeName} ${baseName}`;
        const isShield = armorClass === "shield";
        definitions.push(
          homebrewSource({
            definitionKey: `dmos:armor:${slugify(themeName)}:${slugify(baseName)}:${slugify(tier.rarity)}`,
            name: tier.rarity === "Common" ? name : `${name} (${tier.rarity})`,
            aliases: [name],
            category: "armor",
            subcategory: String(armorClass),
            rarity: tier.rarity,
            attunement: tier.rarity === "Very Rare" || tier.rarity === "Legendary",
            equippable: true,
            equipSlots: isShield ? ["off_hand"] : ["chest"],
            description: `${baseName} carrying ${themeName.toLowerCase()} enchantments; ${visual}. While equipped, you gain resistance to ${energyType} damage${tier.bonus ? ` and a +${tier.bonus} magical bonus to AC` : ""}.`,
            mechanics: {
              baseItem: baseName,
              baseAc,
              armorClass,
              acBonus: tier.bonus,
              resistance: energyType,
            },
            effects: [
              ...(tier.bonus ? [{ type: "stat_mod", stat: "ac", modifier: tier.bonus }] : []),
              { type: "resistance", damageType: energyType },
            ],
            actions: ["inspect", "equip"],
            tags: ["dnd5e", "homebrew", "armor", themeName.toLowerCase(), energyType, tier.rarity.toLowerCase()],
            costAmount: tier.value,
            costCurrency: "gp",
          }),
        );
      }
    }
  }

  // 400 wondrous items: 20 forms x 4 themes x 5 rarities.
  for (const form of WONDROUS_FORMS) {
    for (const [themeName, energyType, visual] of THEMES.slice(6, 10)) {
      for (const tier of HOMEBREW_RARITIES) {
        const name = `${form} of ${themeName}`;
        const lowerForm = form.toLowerCase();
        const slots = /ring/.test(lowerForm)
          ? ["ring"]
          : /boots/.test(lowerForm)
            ? ["feet"]
            : /gloves/.test(lowerForm)
              ? ["hands"]
              : /cloak/.test(lowerForm)
                ? ["back"]
                : /circlet/.test(lowerForm)
                  ? ["head"]
                  : /amulet|medallion/.test(lowerForm)
                    ? ["neck"]
                    : /belt/.test(lowerForm)
                      ? ["waist"]
                      : /bracers/.test(lowerForm)
                        ? ["wrists"]
                        : [];
        definitions.push(
          homebrewSource({
            definitionKey: `dmos:wondrous:${slugify(form)}:${slugify(themeName)}:${slugify(tier.rarity)}`,
            name: tier.rarity === "Common" ? name : `${name} (${tier.rarity})`,
            aliases: [name],
            category: "magic",
            subcategory: "wondrous item",
            rarity: tier.rarity,
            attunement: tier.rarity !== "Common",
            equippable: slots.length > 0,
            equipSlots: slots,
            useAction: "activate",
            description: `A ${lowerForm} infused with ${themeName.toLowerCase()} power; ${visual}. It holds ${Math.max(1, tier.bonus + 1)} charge${tier.bonus + 1 === 1 ? "" : "s"}, regaining all expended charges at dawn. As a Bonus Action, expend 1 charge to deal ${tier.die} ${energyType} damage to one creature you can see within 30 feet, or grant yourself resistance to ${energyType} damage until the start of your next turn.`,
            mechanics: {
              charges: Math.max(1, tier.bonus + 1),
              recharge: "dawn",
              activation: "bonus_action",
              rangeFeet: 30,
              damage: tier.die,
              damageType: energyType,
              alternateEffect: `resistance:${energyType}:1_round`,
            },
            actions: ["inspect", ...(slots.length ? ["equip"] : []), "use"],
            tags: ["dnd5e", "homebrew", "wondrous", themeName.toLowerCase(), energyType, tier.rarity.toLowerCase()],
            costAmount: tier.value,
            costCurrency: "gp",
          }),
        );
      }
    }
  }

  // 200 consumables: 10 forms x 4 themes x 5 rarities.
  for (const form of CONSUMABLE_FORMS) {
    for (const [themeName, energyType, visual] of THEMES.slice(10, 14)) {
      for (const tier of HOMEBREW_RARITIES) {
        const name = `${themeName} ${form}`;
        definitions.push(
          homebrewSource({
            definitionKey: `dmos:consumable:${slugify(themeName)}:${slugify(form)}:${slugify(tier.rarity)}`,
            name: tier.rarity === "Common" ? name : `${name} (${tier.rarity})`,
            aliases: [name],
            category: "consumable",
            subcategory: form.toLowerCase(),
            rarity: tier.rarity,
            consumable: true,
            useAction: "consume",
            description: `A single-use ${form.toLowerCase()} carrying ${themeName.toLowerCase()} magic; ${visual}. As a Bonus Action, consume or apply it to gain resistance to ${energyType} damage for 1 hour and ${tier.die} temporary hit points.`,
            mechanics: {
              activation: "bonus_action",
              duration: "1_hour",
              resistance: energyType,
              temporaryHp: tier.die,
              consumesQuantity: 1,
            },
            effects: [
              { type: "resistance", damageType: energyType, duration: "1_hour" },
              { type: "temporary_hp", dice: tier.die },
            ],
            actions: ["inspect", "use"],
            tags: ["dnd5e", "homebrew", "consumable", themeName.toLowerCase(), energyType, tier.rarity.toLowerCase()],
            costAmount: Math.max(10, Math.round(tier.value / 2)),
            costCurrency: "gp",
          }),
        );
      }
    }
  }

  // A small set of readable/viewable objects so Claude's Read/View work has canonical behaviour examples.
  const readableTemplates = [
    ["Bounty Notice", "A posted notice naming a wanted person, their alleged crimes, reward, authority, and last known whereabouts."],
    ["Regional Map", "A practical map showing settlements, roads, waterways, terrain, landmarks, and whatever annotations its maker added."],
    ["Dungeon Survey", "A hand-drawn survey of explored chambers, doors, hazards, elevations, and incomplete passages."],
    ["Merchant Ledger", "A bound record of transactions, dates, counterparties, quantities, prices, debts, and notes."],
    ["Sealed Letter", "A folded letter intended for a specific recipient; its contents belong in a document-style read view rather than narration."],
    ["Arcane Field Notes", "A research notebook containing observations, sketches, formulae, failed experiments, and marginalia."],
  ] as const;
  for (const [name, description] of readableTemplates) {
    definitions.push(
      homebrewSource({
        definitionKey: `dmos:document:${slugify(name)}`,
        name,
        category: "gear",
        subcategory: /map|survey/.test(name.toLowerCase()) ? "map" : "document",
        rarity: "Common",
        readable: true,
        viewable: /map|survey/.test(name.toLowerCase()),
        description,
        mechanics: { contentGeneratedFromCampaignContext: true, consumesTurn: false },
        actions: ["inspect", "read", ...(/map|survey/.test(name.toLowerCase()) ? ["view"] : [])],
        tags: ["dnd5e", "homebrew", "document", "readable"],
        costAmount: 1,
        costCurrency: "gp",
        publicationStatus: "published",
      }),
    );
  }

  return definitions;
}

export function seedDungeonMasterOSHomebrew(): number {
  const rows = generateHomebrewDefinitions();
  const transaction = sqlite.transaction(() => rows.forEach(writeDefinition));
  transaction();
  return rows.length;
}

export interface CompendiumInitResult {
  homebrewSeeded: number;
  canonicalImported: number;
  canonicalErrors: string[];
  totalDefinitions: number;
}

export async function initializeCompendium(): Promise<CompendiumInitResult> {
  ensureCompendiumSchema();

  const homebrewSeeded = seedDungeonMasterOSHomebrew();
  const canonicalCount = Number(
    (sqlite
      .prepare("SELECT COUNT(*) AS count FROM item_definitions WHERE source_kind = 'canonical_srd'")
      .get() as any)?.count || 0,
  );

  const forceSync = process.env.COMPENDIUM_FORCE_SYNC === "true";
  const disableSync = process.env.COMPENDIUM_SYNC_ON_START === "false";
  let canonicalImported = 0;
  const canonicalErrors: string[] = [];

  if (!disableSync && (canonicalCount < 50 || forceSync)) {
    const results = await Promise.allSettled(SRD_SOURCES.map(importSrdSource));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") canonicalImported += result.value;
      else canonicalErrors.push(`${SRD_SOURCES[index].id}: ${String(result.reason?.message || result.reason)}`);
    });
  }

  const totalDefinitions = Number(
    (sqlite.prepare("SELECT COUNT(*) AS count FROM item_definitions").get() as any)?.count || 0,
  );

  return { homebrewSeeded, canonicalImported, canonicalErrors, totalDefinitions };
}

export function getDefinitionByKey(definitionKey: string): any | undefined {
  return sqlite.prepare("SELECT * FROM item_definitions WHERE definition_key = ?").get(definitionKey);
}

export function searchItemDefinitions(query: string, limit = 20): any[] {
  const normalized = normalizeName(query);
  if (!normalized) return [];

  try {
    const ftsRows = sqlite
      .prepare(`
        SELECT d.*
        FROM item_definitions_fts f
        JOIN item_definitions d ON d.definition_key = f.definition_key
        WHERE item_definitions_fts MATCH ?
        ORDER BY bm25(item_definitions_fts)
        LIMIT ?
      `)
      .all(`${normalized.replace(/[^a-z0-9 ]/g, " ")}*`, limit) as any[];
    if (ftsRows.length) return ftsRows;
  } catch {
    // Fall through to alias/name lookup.
  }

  return sqlite
    .prepare(`
      SELECT DISTINCT d.*
      FROM item_definitions d
      LEFT JOIN item_definition_aliases a ON a.definition_key = d.definition_key
      WHERE d.normalized_name LIKE ? OR a.normalized_alias LIKE ?
      ORDER BY
        CASE WHEN d.normalized_name = ? THEN 0 ELSE 1 END,
        d.is_homebrew ASC,
        d.name ASC
      LIMIT ?
    `)
    .all(`%${normalized}%`, `%${normalized}%`, normalized, limit) as any[];
}

export function getCompendiumStats(): Record<string, number> {
  const rows = sqlite
    .prepare(`
      SELECT source_kind AS sourceKind, COUNT(*) AS count
      FROM item_definitions
      GROUP BY source_kind
    `)
    .all() as Array<{ sourceKind: string; count: number }>;
  return Object.fromEntries(rows.map((row) => [row.sourceKind, Number(row.count)]));
}

export const compendiumAttribution = {
  officialSrd: {
    source: "Dungeons & Dragons System Reference Document 5.1 / 5.2.1",
    publisher: "Wizards of the Coast",
    license: "CC BY 4.0",
    licenseUrl: CC_BY_4_URL,
    sourceUrl: OFFICIAL_SRD_URL,
  },
  dataProvider: {
    name: "5e-bits / 5e-database",
    url: FIVE_E_BITS,
  },
};
