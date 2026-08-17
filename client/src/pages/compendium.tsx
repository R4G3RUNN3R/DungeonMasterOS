import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, Search, SlidersHorizontal, X } from "lucide-react";
import CompendiumBook from "@/components/CompendiumBook";
import {
  type CompendiumFacets,
  type CompendiumItem,
  type CompendiumListResponse,
  categoryLabel,
  humanize,
  itemPath,
  rulesetLabel,
  sourceKindLabel,
} from "@/lib/compendium";

type Filters = {
  q: string;
  category: string;
  rarity: string;
  edition: string;
  source: string;
  interaction: string;
  sort: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  category: "",
  rarity: "",
  edition: "",
  source: "",
  interaction: "",
  sort: "name",
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

function activeFilterCount(filters: Filters): number {
  return [filters.q, filters.category, filters.rarity, filters.edition, filters.source, filters.interaction]
    .filter(Boolean).length + (filters.sort !== "name" ? 1 : 0);
}

function FiltersPanel({
  value,
  facets,
  onChange,
  onApply,
  onClear,
}: {
  value: Filters;
  facets?: CompendiumFacets;
  onChange: (next: Filters) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const set = (key: keyof Filters, next: string) => onChange({ ...value, [key]: next });

  return (
    <>
      <div className="compendium-running-head">
        <span>Index & Catalogue</span>
        <span>Find an Entry</span>
      </div>
      <h2 className="compendium-h2">Browse the Archive</h2>
      <p className="compendium-copy">
        Search by name or description, then narrow the catalogue by type, rarity, rules era, provenance, or how an item can be used.
      </p>

      <div className="compendium-filter-grid">
        <div className="compendium-field compendium-field-wide">
          <label htmlFor="compendium-search">Search the compendium</label>
          <input
            id="compendium-search"
            value={value.q}
            onChange={(event) => set("q", event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") onApply(); }}
            placeholder="Longsword, healing, shadow, map..."
          />
        </div>
        <div className="compendium-field">
          <label>Category</label>
          <select value={value.category} onChange={(event) => set("category", event.target.value)}>
            <option value="">All categories</option>
            {facets?.categories.map((facet) => (
              <option key={facet.value} value={facet.value}>{categoryLabel(facet.value)} ({facet.count})</option>
            ))}
          </select>
        </div>
        <div className="compendium-field">
          <label>Rarity</label>
          <select value={value.rarity} onChange={(event) => set("rarity", event.target.value)}>
            <option value="">All rarities</option>
            {facets?.rarities.map((facet) => (
              <option key={facet.value} value={facet.value}>{facet.value} ({facet.count})</option>
            ))}
          </select>
        </div>
        <div className="compendium-field">
          <label>Rules era</label>
          <select value={value.edition} onChange={(event) => set("edition", event.target.value)}>
            <option value="">All editions</option>
            {facets?.editions.map((facet) => (
              <option key={facet.value} value={facet.value}>{facet.value || "Unspecified"} ({facet.count})</option>
            ))}
          </select>
        </div>
        <div className="compendium-field">
          <label>Source</label>
          <select value={value.source} onChange={(event) => set("source", event.target.value)}>
            <option value="">All sources</option>
            {facets?.sourceKinds.map((facet) => (
              <option key={facet.value} value={facet.value}>{sourceKindLabel(facet.value)} ({facet.count})</option>
            ))}
          </select>
        </div>
        <div className="compendium-field">
          <label>Interaction</label>
          <select value={value.interaction} onChange={(event) => set("interaction", event.target.value)}>
            <option value="">Any interaction</option>
            <option value="equip">Equippable</option>
            <option value="use">Usable / Activatable</option>
            <option value="read">Readable</option>
            <option value="view">Viewable</option>
          </select>
        </div>
        <div className="compendium-field">
          <label>Order</label>
          <select value={value.sort} onChange={(event) => set("sort", event.target.value)}>
            <option value="name">Name A–Z</option>
            <option value="rarity">Rarity, low to high</option>
            <option value="rarity-desc">Rarity, high to low</option>
            <option value="category">Category</option>
            <option value="source">Source</option>
          </select>
        </div>
      </div>

      <div className="compendium-filter-actions">
        <button type="button" className="compendium-button" onClick={onApply}>
          <Search size={14} /> Open Catalogue
        </button>
        <button type="button" className="compendium-button secondary" onClick={onClear}>
          <X size={14} /> Clear
        </button>
      </div>

      <div className="compendium-note-box">
        Canon entries and original homebrew live in the same searchable reference library, but their source is always shown on the item entry. Rules-era filters keep similarly named items from different editions from pretending they are mechanically identical.
      </div>
    </>
  );
}

function CataloguePage({ items, side, total, loading }: { items: CompendiumItem[]; side: "left" | "right"; total: number; loading: boolean }) {
  return (
    <>
      <div className="compendium-running-head">
        <span>Item Compendium</span>
        <span>{side === "left" ? "Catalogue" : `${total.toLocaleString()} Entries`}</span>
      </div>
      <div className="compendium-results-summary">
        {loading ? "Turning through the index..." : `${total.toLocaleString()} matching entr${total === 1 ? "y" : "ies"}`}
      </div>
      {loading ? (
        <div className="compendium-empty"><div>Consulting the shelves...</div></div>
      ) : items.length ? (
        <div className="compendium-index-list">
          {items.map((item) => (
            <Link key={item.definitionKey} href={itemPath(item.definitionKey)} className="compendium-index-entry">
              <span className="compendium-entry-glyph">{item.name.trim().charAt(0).toUpperCase() || "•"}</span>
              <span>
                <span className="compendium-entry-name">{item.name}</span>
                <span className="compendium-entry-meta">
                  {categoryLabel(item.category)}{item.subcategory ? ` · ${humanize(item.subcategory)}` : ""}<br />
                  {rulesetLabel(item)} · {sourceKindLabel(item.sourceKind)}
                </span>
              </span>
              <span className="compendium-rarity">{item.rarity}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="compendium-empty">
          <div>
            <h3 className="compendium-h3">No entry answers that description.</h3>
            <p className="compendium-copy">Try widening the filters. Even magical libraries occasionally fail to contain the exact nonsense adventurers request.</p>
          </div>
        </div>
      )}
    </>
  );
}

export default function CompendiumPage() {
  const [spread, setSpread] = useState(0);
  const [mobileSide, setMobileSide] = useState<0 | 1>(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });

  const facetsQuery = useQuery({
    queryKey: ["/api/compendium/facets"],
    queryFn: () => getJson<CompendiumFacets>("/api/compendium/facets"),
  });

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(Math.max(1, spread)), pageSize: "12" });
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || (key === "sort" && value === "name")) return;
      params.set(key, value);
    });
    return `/api/compendium/items?${params.toString()}`;
  }, [filters, spread]);

  const listQuery = useQuery({
    queryKey: ["compendium-items", listUrl],
    queryFn: () => getJson<CompendiumListResponse>(listUrl),
    enabled: spread > 0,
    placeholderData: (previous) => previous,
  });

  const data = listQuery.data;
  const leftItems = data?.items.slice(0, 6) || [];
  const rightItems = data?.items.slice(6, 12) || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  const applyFilters = () => {
    setFilters({ ...draftFilters });
    setSpread(1);
    setMobileSide(0);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
    setSpread(1);
    setMobileSide(0);
    setFiltersOpen(false);
  };

  const turn = (direction: "next" | "prev") => {
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (mobile) {
      if (direction === "next") {
        if (mobileSide === 0) {
          setMobileSide(1);
          return;
        }
        setMobileSide(0);
        setSpread((current) => current === 0 ? 1 : Math.min(pageCount, current + 1));
        return;
      }

      if (mobileSide === 1) {
        setMobileSide(0);
        return;
      }
      if (spread > 0) {
        if (spread === 1) {
          setSpread(0);
          setMobileSide(1);
        } else {
          setSpread((current) => Math.max(1, current - 1));
          setMobileSide(1);
        }
      }
      return;
    }

    if (direction === "next") setSpread((current) => current === 0 ? 1 : Math.min(pageCount, current + 1));
    else setSpread((current) => Math.max(0, current - 1));
  };

  const canPrevious = spread > 0 || mobileSide === 1;
  const rightPageHasContent = spread === 0 || rightItems.length > 0;
  const canNext = spread === 0
    ? true
    : mobileSide === 0
      ? rightPageHasContent
      : spread < pageCount;

  const leftPage = spread === 0 ? (
    <>
      <div className="compendium-running-head">
        <span>DungeonMasterOS</span>
        <span>Volume I · Items & Equipment</span>
      </div>
      <span className="compendium-smallcaps">A Living Reference</span>
      <h1 className="compendium-book-title">The Item<br />Compendium</h1>
      <div className="compendium-ornament"><span className="compendium-ornament-mark" /></div>
      <p className="compendium-book-subtitle compendium-dropcap">
        A catalogue of arms, armour, tools, curiosities, relics, consumables, documents, and stranger things that may pass through an adventurer's hands.
      </p>
      <div className="compendium-intro-stats">
        <div className="compendium-stat-card">
          <span className="compendium-stat-value">{(facetsQuery.data?.total || 0).toLocaleString()}</span>
          <span className="compendium-stat-label">Published Entries</span>
        </div>
        <div className="compendium-stat-card">
          <span className="compendium-stat-value">{(facetsQuery.data?.canonical || 0).toLocaleString()}</span>
          <span className="compendium-stat-label">SRD Canon</span>
        </div>
        <div className="compendium-stat-card">
          <span className="compendium-stat-value">{(facetsQuery.data?.homebrew || 0).toLocaleString()}</span>
          <span className="compendium-stat-label">Homebrew Entries</span>
        </div>
        <div className="compendium-stat-card">
          <span className="compendium-stat-value">{facetsQuery.data?.categories.length || 0}</span>
          <span className="compendium-stat-label">Categories</span>
        </div>
      </div>
      <div className="compendium-note-box">
        Turn pages with the far edges of the screen or the left and right arrow keys. Item entries retain their rules era and source so the compendium can grow without flattening every edition into one contradictory soup.
      </div>
    </>
  ) : (
    <CataloguePage items={leftItems} side="left" total={total} loading={listQuery.isFetching && !data} />
  );

  const rightPage = spread === 0 ? (
    <FiltersPanel
      value={draftFilters}
      facets={facetsQuery.data}
      onChange={setDraftFilters}
      onApply={applyFilters}
      onClear={clearFilters}
    />
  ) : (
    <CataloguePage items={rightItems} side="right" total={total} loading={listQuery.isFetching && !data} />
  );

  return (
    <CompendiumBook
      leftPage={leftPage}
      rightPage={rightPage}
      leftPageNumber={spread * 2 + 1}
      rightPageNumber={spread * 2 + 2}
      mobileSide={mobileSide}
      canPrevious={canPrevious}
      canNext={canNext}
      onTurn={turn}
      onFilters={() => { setDraftFilters({ ...filters }); setFiltersOpen(true); }}
      filterLabel={activeFilterCount(filters) ? `Filters (${activeFilterCount(filters)})` : "Search & Filters"}
    >
      {filtersOpen && (
        <div className="compendium-filter-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) setFiltersOpen(false); }}>
          <div className="compendium-filter-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div>
                <span className="compendium-smallcaps"><BookMarked size={12} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />Quick Index</span>
                <h2 className="compendium-h2" style={{ marginTop: 6 }}>Search & Filters</h2>
              </div>
              <button type="button" className="compendium-button secondary" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={15} /></button>
            </div>
            <FiltersPanel
              value={draftFilters}
              facets={facetsQuery.data}
              onChange={setDraftFilters}
              onApply={applyFilters}
              onClear={clearFilters}
            />
          </div>
        </div>
      )}
    </CompendiumBook>
  );
}
