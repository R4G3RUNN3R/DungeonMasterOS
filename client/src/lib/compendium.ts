export interface CompendiumItem {
  id: number;
  definitionKey: string;
  ruleset: string;
  edition: string;
  name: string;
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
  sourceKind: string;
  sourceTitle: string;
  sourcePublisher: string;
  sourceLicense: string;
  sourceLicenseUrl: string;
  sourceUrl: string;
  sourceReference: string;
  sourceRecordId: string;
  dataProvider: string;
  isHomebrew: boolean;
  featured: boolean;
}

export interface CompendiumFacet {
  value: string;
  count: number;
}

export interface CompendiumFacets {
  total: number;
  featured: number;
  canonical: number;
  homebrew: number;
  categories: CompendiumFacet[];
  rarities: CompendiumFacet[];
  sourceKinds: CompendiumFacet[];
  editions: CompendiumFacet[];
  rulesets: CompendiumFacet[];
}

export interface CompendiumListResponse {
  items: CompendiumItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function sourceKindLabel(value: string): string {
  switch (value) {
    case "canonical_srd":
      return "SRD Canon";
    case "voidsmith_homebrew":
      return "DungeonMasterOS Homebrew";
    case "third_party_open":
      return "Open Third-Party";
    case "campaign_homebrew":
      return "Campaign Homebrew";
    default:
      return humanize(value);
  }
}

export function rulesetLabel(item: Pick<CompendiumItem, "ruleset" | "edition">): string {
  if (item.ruleset === "dnd5e") {
    if (item.edition === "2014") return "5e · 2014 Rules";
    if (item.edition === "2024") return "5e · 2024 Rules";
    return "5e";
  }
  return [humanize(item.ruleset), item.edition].filter(Boolean).join(" · ");
}

export function formatCost(item: Pick<CompendiumItem, "costAmount" | "costCurrency">): string {
  if (item.costAmount == null) return "—";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(item.costAmount)} ${item.costCurrency || ""}`.trim();
}

export function itemPath(definitionKey: string): string {
  return `/compendium/items/${encodeURIComponent(definitionKey)}`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function sourceHref(item: Pick<CompendiumItem, "sourceReference" | "sourceUrl">): string {
  if (item.sourceReference && isHttpUrl(item.sourceReference)) return item.sourceReference;
  if (item.sourceUrl && isHttpUrl(item.sourceUrl)) return item.sourceUrl;
  return "";
}

export function sourceLabel(item: Pick<CompendiumItem, "sourceTitle" | "sourceKind">): string {
  return item.sourceTitle || sourceKindLabel(item.sourceKind);
}

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    armor: "Armour",
    weapon: "Weapons",
    consumable: "Consumables",
    gear: "Adventuring Gear",
    tool: "Tools",
    magic: "Magic Items",
    key: "Keys & Access",
    property: "Property",
    vehicle: "Vehicles",
    vessel: "Vessels",
    mount: "Mounts",
    creature: "Creatures",
    retainer: "Retainers",
    misc: "Miscellaneous",
  };
  return labels[category] || humanize(category);
}

export function rarityRank(rarity: string): number {
  const value = rarity.toLowerCase();
  if (value === "common") return 1;
  if (value === "uncommon") return 2;
  if (value === "rare") return 3;
  if (value === "very rare") return 4;
  if (value === "legendary") return 5;
  if (value === "artifact") return 6;
  return 7;
}
