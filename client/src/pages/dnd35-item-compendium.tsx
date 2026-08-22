import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import CompendiumBook from "@/components/CompendiumBook";
import type { PublicDnd35Item } from "@/lib/knowledge-library";
import "@/library.css";

type ItemResponse = {
  edition: "3.5e";
  corpusStatus: string;
  sourceRevision: string;
  items: PublicDnd35Item[];
};

function words(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceLine(item: PublicDnd35Item) {
  return item.sources.map((source) => [source.abbreviation, source.section].filter(Boolean).join(" · ")).join("; ");
}

function cleanRules(value: string) {
  return value.replace(/_([^_]+)_/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\s+/g, " ").trim();
}

function ItemPage({ item }: { item: PublicDnd35Item }) {
  const paragraphs = item.rulesText?.split(/\n\s*\n/).map(cleanRules).filter(Boolean) ?? [];
  return (
    <article>
      <h2 className="rules-tome-heading">{item.name}</h2>
      <div className="rules-tome-subheading">{words(item.category)}{item.subcategory ? ` · ${words(item.subcategory)}` : ""}</div>
      {item.price && <div className="rules-tome-stat"><strong>Cost</strong><span>{item.price.text}</span></div>}
      {item.weightLb != null && <div className="rules-tome-stat"><strong>Weight</strong><span>{item.weightLb} lb.</span></div>}
      {item.weapon && (
        <>
          <div className="rules-tome-stat"><strong>Damage</strong><span>Small {item.weapon.damageSmall || "—"}; Medium {item.weapon.damageMedium || "—"}</span></div>
          <div className="rules-tome-stat"><strong>Critical</strong><span>{item.weapon.critical || "Standard"}</span></div>
          {item.weapon.rangeIncrementFeet != null && <div className="rules-tome-stat"><strong>Range Increment</strong><span>{item.weapon.rangeIncrementFeet} ft.</span></div>}
          <div className="rules-tome-stat"><strong>Type</strong><span>{item.weapon.damageTypes.map(words).join(" / ") || "Special"}</span></div>
          <div className="rules-tome-stat"><strong>Training</strong><span>{words(item.weapon.proficiency)} · {words(item.weapon.usage)}</span></div>
        </>
      )}
      {item.armor && (
        <>
          <div className="rules-tome-stat"><strong>AC Bonus</strong><span>{item.armor.armorOrShieldBonus != null ? `+${item.armor.armorOrShieldBonus}` : "Special"}</span></div>
          <div className="rules-tome-stat"><strong>Maximum Dex</strong><span>{item.armor.maximumDexBonus == null ? "—" : `+${item.armor.maximumDexBonus}`}</span></div>
          <div className="rules-tome-stat"><strong>Armor Check Penalty</strong><span>{item.armor.armorCheckPenalty == null ? "—" : item.armor.armorCheckPenalty}</span></div>
          <div className="rules-tome-stat"><strong>Arcane Spell Failure</strong><span>{item.armor.arcaneSpellFailurePercent == null ? "—" : `${item.armor.arcaneSpellFailurePercent}%`}</span></div>
          {(item.armor.speed30Feet != null || item.armor.speed20Feet != null) && <div className="rules-tome-stat"><strong>Speed</strong><span>30-ft. base: {item.armor.speed30Feet ?? "—"} ft.; 20-ft. base: {item.armor.speed20Feet ?? "—"} ft.</span></div>}
        </>
      )}
      <div className="rules-tome-rule" />
      {paragraphs.length ? paragraphs.map((paragraph, index) => <p className="rules-tome-copy" key={`${item.id}-rule-${index}`}>{paragraph}</p>) : <p className="rules-tome-copy">{item.rulesSummary}</p>}
      <div className="rules-tome-source">Source: {sourceLine(item)}</div>
    </article>
  );
}

export default function Dnd35ItemCompendiumPage() {
  const [closed, setClosed] = useState(true);
  const [query, setQuery] = useState("");
  const [spread, setSpread] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const result = useQuery<ItemResponse>({ queryKey: ["/api/knowledge/dnd35/items"] });

  const entries = useMemo(() => {
    const all = result.data?.items ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((item) => [item.name, item.category, item.subcategory, item.rulesSummary, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query, result.data]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const safeSpread = Math.min(spread, pageCount - 1);
  const visible = entries.slice(safeSpread * pageSize, safeSpread * pageSize + pageSize);
  const selected = entries.find((item) => item.id === selectedId) ?? visible[0];
  const corpusMessage = result.data?.corpusStatus === "srd-equipment"
    ? `${entries.length} indexed equipment records are loaded from the pinned Revised 3.5 SRD. Magic items are still being catalogued and will join this volume without changing these mundane records.`
    : "The pinned 3.5 equipment corpus is not available. DungeonMasterOS will not substitute the 5e Item Compendium or AI-invented equipment statistics.";

  const leftPage = (
    <section>
      <div className="rules-tome-subheading">Dungeons & Dragons 3.5 Edition</div>
      <h1 className="rules-tome-heading">The Item Compendium</h1>
      <p className="rules-tome-copy">Weapons, armor, shields and equipment as recorded for this edition. These are the same canonical item definitions used to reconcile rewards and equipment mechanics during play.</p>
      <div className="rules-tome-warning">{corpusMessage}</div>
      <input className="rules-tome-search" value={query} onChange={(event) => { setQuery(event.target.value); setSpread(0); setSelectedId(null); }} placeholder="Search the item compendium..." aria-label="Search the D&D 3.5 Item Compendium" />
      <div className="rules-tome-index">
        {visible.map((item) => (
          <button type="button" key={item.id} className={selected?.id === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}>{item.name}</button>
        ))}
      </div>
      <div className="rules-tome-source">Index spread {safeSpread + 1} of {pageCount} · {entries.length} catalogued records</div>
    </section>
  );

  const rightPage = result.isLoading
    ? <p className="rules-tome-copy">The quartermaster is sorting the shelves...</p>
    : selected
      ? <ItemPage item={selected} />
      : <p className="rules-tome-copy">No verified item matches this index.</p>;

  return (
    <CompendiumBook
      leftPage={leftPage}
      rightPage={rightPage}
      leftPageNumber={safeSpread * 2 + 1}
      rightPageNumber={safeSpread * 2 + 2}
      canPrevious={safeSpread > 0}
      canNext={safeSpread + 1 < pageCount}
      onTurn={(direction) => { setSelectedId(null); setSpread((current) => Math.max(0, Math.min(pageCount - 1, current + (direction === "next" ? 1 : -1)))); }}
      closed={closed}
      onOpen={() => setClosed(false)}
      coverKicker="DungeonMasterOS · D&D 3.5 Edition"
      coverTitle="The Item Compendium"
      coverVolume={<>Arms, Armor & Equipment<br />Library of Knowledge</>}
      coverAriaLabel="Open the D&D 3.5 Item Compendium"
      coverTitleAttribute="Open the D&D 3.5 Item Compendium"
      coverEmblem={<Shield />}
      filterLabel="Search Item Compendium"
    />
  );
}
