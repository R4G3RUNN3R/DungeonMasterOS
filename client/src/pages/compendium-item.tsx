import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import CompendiumBook from "@/components/CompendiumBook";
import CompendiumSourceLink from "@/components/CompendiumSourceLink";
import {
  type CompendiumItem,
  type CompendiumListResponse,
  categoryLabel,
  formatCost,
  humanize,
  itemPath,
  rulesetLabel,
  sourceHref,
  sourceKindLabel,
} from "@/lib/compendium";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

function readableValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry && typeof entry === "object" && "name" in entry) return String((entry as any).name || "");
        return readableValue(entry);
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, any>;
    if (record.name) return String(record.name);
    if (record.damage_dice) return String(record.damage_dice);
    if (record.dice_count && record.dice_value) return `${record.dice_count}d${record.dice_value}`;
    if (record.normal != null) return `${record.normal} ft${record.long ? ` / ${record.long} ft` : ""}`;
    if (record.base != null) return String(record.base);
    return Object.entries(record)
      .filter(([, nested]) => ["string", "number", "boolean"].includes(typeof nested))
      .slice(0, 4)
      .map(([key, nested]) => `${humanize(key)}: ${readableValue(nested)}`)
      .join("; ");
  }
  return "";
}

function mechanicRows(item: CompendiumItem): Array<[string, string]> {
  const mechanics = item.mechanics as Record<string, any>;
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => {
    const rendered = readableValue(value);
    if (rendered && !rows.some(([existing]) => existing === label)) rows.push([label, rendered]);
  };

  add("Damage", mechanics.damage?.damage_dice || mechanics.damage);
  add("Damage type", mechanics.damage?.damage_type?.name || mechanics.damageType);
  add("Two-handed damage", mechanics.two_handed_damage?.damage_dice);
  add("Range", mechanics.range || mechanics.rangeFeet);
  add("Armour class", mechanics.armor_class || mechanics.armorClass);
  add("Strength requirement", mechanics.str_minimum || mechanics.strengthRequirement);
  if (mechanics.stealth_disadvantage) add("Stealth", "Disadvantage while worn");
  add("Properties", mechanics.properties);
  add("Bonus", mechanics.bonus);
  add("Charges", mechanics.charges);
  add("Recharge", mechanics.recharge);
  add("Activation", mechanics.activation);
  add("Duration", mechanics.duration);
  add("Resistance", mechanics.resistance);
  add("Temporary hit points", mechanics.temporaryHp);
  add("Alternate effect", mechanics.alternateEffect);
  add("Special", mechanics.special);
  return rows.slice(0, 12);
}

function Properties({ item }: { item: CompendiumItem }) {
  const properties = [
    ["Category", categoryLabel(item.category) + (item.subcategory ? ` · ${humanize(item.subcategory)}` : "")],
    ["Rarity", item.rarity || "—"],
    ["Rules", rulesetLabel(item)],
    ["Attunement", item.attunement ? "Required" : "Not required"],
    ["Weight", item.weight == null ? "—" : `${item.weight} lb`],
    ["Value", formatCost(item)],
    ["Equip slots", item.equipSlots.length ? item.equipSlots.map(humanize).join(", ") : "—"],
    ["Interactions", item.actions.length ? item.actions.map(humanize).join(", ") : "Inspect"],
  ];

  return (
    <div className="compendium-property-grid">
      {properties.map(([label, value]) => (
        <div className="compendium-property" key={label}>
          <span className="compendium-property-label">{label}</span>
          <span className="compendium-property-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function CompendiumItemPage() {
  const [, params] = useRoute("/compendium/items/:definitionKey");
  const definitionKey = params?.definitionKey ? decodeURIComponent(params.definitionKey) : "";
  const isMobile = useIsMobile();
  const [spread, setSpread] = useState(0);
  const [mobileSide, setMobileSide] = useState<0 | 1>(0);

  const itemQuery = useQuery({
    queryKey: ["compendium-item", definitionKey],
    queryFn: () => getJson<CompendiumItem>(`/api/compendium/items/${encodeURIComponent(definitionKey)}`),
    enabled: Boolean(definitionKey),
  });

  const item = itemQuery.data;
  const relatedUrl = item
    ? `/api/compendium/items?category=${encodeURIComponent(item.category)}&page=1&pageSize=8&sort=rarity-desc`
    : "";
  const relatedQuery = useQuery({
    queryKey: ["compendium-related", relatedUrl],
    queryFn: () => getJson<CompendiumListResponse>(relatedUrl),
    enabled: Boolean(relatedUrl),
  });

  const related = useMemo(
    () => (relatedQuery.data?.items || []).filter((entry) => entry.definitionKey !== definitionKey).slice(0, 6),
    [definitionKey, relatedQuery.data],
  );

  if (itemQuery.isError) {
    return (
      <CompendiumBook
        leftPage={<><div className="compendium-running-head"><span>Compendium</span><span>Missing Entry</span></div><h1 className="compendium-detail-title">Entry Not Found</h1><p className="compendium-copy">That page is absent from the current volume.</p><p><Link href="/compendium" className="compendium-button secondary"><ArrowLeft size={14} /> Return to the Compendium</Link></p></>}
        rightPage={<div className="compendium-empty">The facing page is blank.</div>}
        leftPageNumber={1}
        rightPageNumber={2}
      />
    );
  }

  if (!item) {
    return (
      <CompendiumBook
        leftPage={<div className="compendium-empty">Opening the requested entry...</div>}
        rightPage={<div className="compendium-empty">Consulting the index...</div>}
        leftPageNumber={1}
        rightPageNumber={2}
      />
    );
  }

  const rows = mechanicRows(item);
  const provenanceHref = sourceHref(item);

  const firstLeft = (
    <>
      <div className="compendium-running-head"><span>Item Compendium</span><span>{sourceKindLabel(item.sourceKind)}</span></div>
      <Link href="/compendium" className="compendium-button secondary" style={{ marginBottom: 24, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Catalogue
      </Link>
      <span className="compendium-smallcaps">{categoryLabel(item.category)}</span>
      <h1 className="compendium-detail-title">{item.name}</h1>
      <div className="compendium-detail-source-under-title"><CompendiumSourceLink item={item} /></div>
      <p className="compendium-detail-kicker">
        {item.subcategory ? `${humanize(item.subcategory)}, ` : ""}{item.rarity}{item.attunement ? " · requires attunement" : ""}
      </p>
      <div className="compendium-ornament"><span className="compendium-ornament-mark" /></div>
      <p className="compendium-copy compendium-dropcap" style={{ whiteSpace: "pre-line" }}>
        {item.description || "No descriptive text has yet been entered for this item."}
      </p>
      {item.tags.length > 0 && (
        <div className="compendium-tags">
          {item.tags.slice(0, 12).map((tag) => <span className="compendium-tag" key={tag}>{humanize(tag)}</span>)}
        </div>
      )}
    </>
  );

  const firstRight = (
    <>
      <div className="compendium-running-head"><span>{item.name}</span><span>Properties & Rules</span></div>
      <h2 className="compendium-h2">Properties</h2>
      <Properties item={item} />
      <h2 className="compendium-h2" style={{ marginTop: 22 }}>Mechanics</h2>
      {rows.length ? (
        <div className="compendium-mechanics-list">
          {rows.map(([label, value]) => (
            <div className="compendium-mechanic-row" key={label}>
              <span className="compendium-mechanic-key">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="compendium-copy">This entry is primarily descriptive; its usable rules are contained in the item text and interactions above.</p>
      )}
      <div className="compendium-note-box">
        <strong>Available actions:</strong> {item.actions.length ? item.actions.map(humanize).join(", ") : "Inspect"}.
        {item.consumable ? " This item is consumed or reduced when used." : ""}
        {item.readable ? " It has readable contents." : ""}
        {item.viewable ? " It can also be viewed as a visual object or document." : ""}
      </div>
    </>
  );

  const secondLeft = (
    <>
      <div className="compendium-running-head"><span>{item.name}</span><span>Source & Provenance</span></div>
      <span className="compendium-smallcaps">Where this entry comes from</span>
      <h2 className="compendium-h2" style={{ marginTop: 6 }}>Source</h2>
      <div className="compendium-source-block">
        <p><strong>Collection:</strong><br />{item.sourceTitle || "DungeonMasterOS Compendium"}</p>
        <p><strong>Classification:</strong><br />{sourceKindLabel(item.sourceKind)}</p>
        {item.sourcePublisher && <p><strong>Creator / Publisher:</strong><br />{item.sourcePublisher}</p>}
        {item.sourceLicense && <p><strong>License:</strong><br />{item.sourceLicense}</p>}
        {item.sourceRecordId && <p><strong>Source record:</strong><br />{item.sourceRecordId}</p>}
        {item.dataProvider && <p><strong>Data reference:</strong><br />{item.dataProvider}</p>}
        {provenanceHref && (
          <p>
            <a href={provenanceHref} target="_blank" rel="noreferrer">Open exact source reference <ExternalLink size={12} style={{ display: "inline", marginLeft: 4, verticalAlign: -1 }} /></a>
          </p>
        )}
      </div>
      <div className="compendium-note-box">
        Source information is part of the item record itself rather than decorative website text. If an entry is corrected, re-sourced, or replaced later, its provenance travels with it.
      </div>
    </>
  );

  const secondRight = (
    <>
      <div className="compendium-running-head"><span>Item Compendium</span><span>Related Discoveries</span></div>
      <h2 className="compendium-h2">Related Entries</h2>
      <p className="compendium-copy">Other entries from the same broad category, useful when browsing rather than searching for a single known name.</p>
      <div className="compendium-index-list" style={{ marginTop: 14 }}>
        {related.length ? related.map((entry) => (
          <article key={entry.definitionKey} className="compendium-index-entry">
            <span className="compendium-entry-glyph">{entry.name.charAt(0).toUpperCase()}</span>
            <span style={{ minWidth: 0 }}>
              <Link href={itemPath(entry.definitionKey)} className="compendium-entry-mainlink">
                <span className="compendium-entry-name">{entry.name}</span>
                <span className="compendium-entry-meta">{categoryLabel(entry.category)} · {sourceKindLabel(entry.sourceKind)}</span>
              </Link>
              <CompendiumSourceLink item={entry} compact />
            </span>
            <span className="compendium-rarity">{entry.rarity}</span>
          </article>
        )) : <div className="compendium-empty">No neighbouring entries are available yet.</div>}
      </div>
    </>
  );

  const turn = (direction: "next" | "prev") => {
    if (isMobile) {
      if (direction === "next") {
        if (mobileSide === 0) setMobileSide(1);
        else if (spread === 0) { setSpread(1); setMobileSide(0); }
        return;
      }
      if (mobileSide === 1) setMobileSide(0);
      else if (spread === 1) { setSpread(0); setMobileSide(1); }
      return;
    }
    if (direction === "next" && spread === 0) setSpread(1);
    else if (direction === "prev" && spread === 1) setSpread(0);
  };

  const canPrevious = isMobile ? mobileSide === 1 || spread === 1 : spread === 1;
  const canNext = isMobile ? mobileSide === 0 || (mobileSide === 1 && spread === 0) : spread === 0;

  return (
    <CompendiumBook
      leftPage={spread === 0 ? firstLeft : secondLeft}
      rightPage={spread === 0 ? firstRight : secondRight}
      leftPageNumber={spread * 2 + 1}
      rightPageNumber={spread * 2 + 2}
      mobileSide={mobileSide}
      canPrevious={canPrevious}
      canNext={canNext}
      onTurn={turn}
    />
  );
}
