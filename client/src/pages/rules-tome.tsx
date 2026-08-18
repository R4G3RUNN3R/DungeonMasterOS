import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles, ScrollText } from "lucide-react";
import CompendiumBook from "@/components/CompendiumBook";
import type { KnowledgeLibraryResponse, PublicDnd35Feat, PublicDnd35Spell } from "@/lib/knowledge-library";
import "@/library.css";

type RulesTomeKind = "grimoire" | "holy-tome" | "feat-codex";

type Props = { kind: RulesTomeKind };

type SpellResponse = { edition: "3.5e"; corpusStatus: string; spells: PublicDnd35Spell[] };
type FeatResponse = { edition: "3.5e"; corpusStatus: string; feats: PublicDnd35Feat[] };

const CONFIG: Record<RulesTomeKind, { title: string; subtitle: string; endpoint: string; icon: typeof BookOpen; volume: string; volumeId: string }> = {
  grimoire: { title: "The Grimoire", subtitle: "Arcane Spells & Workings", endpoint: "/api/knowledge/dnd35/spells?tradition=arcane", icon: Sparkles, volume: "Arcane Reference", volumeId: "dnd35-grimoire" },
  "holy-tome": { title: "The Holy Tome", subtitle: "Divine Spells & Domains", endpoint: "/api/knowledge/dnd35/spells?tradition=divine", icon: ScrollText, volume: "Divine Reference", volumeId: "dnd35-holy-tome" },
  "feat-codex": { title: "The Feat Codex", subtitle: "Feats, Metamagic & Prerequisites", endpoint: "/api/knowledge/dnd35/feats", icon: BookOpen, volume: "Character Reference", volumeId: "dnd35-feat-codex" },
};

function words(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceLine(sources: Array<{ abbreviation: string; section?: string; page?: number }>) {
  return sources.map((source) => [source.abbreviation, source.section, source.page ? `p. ${source.page}` : ""].filter(Boolean).join(" · ")).join("; ");
}

function cleanOpenRulesParagraph(value: string) {
  return value
    .replace(/^_(.+?):_\s*/s, "$1: ")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\\([\[\]])/g, "$1")
    .trim();
}

function SpellPage({ spell }: { spell: PublicDnd35Spell }) {
  const classes = spell.classAccess.map((access) => `${words(access.classId)} ${access.level}`).join(", ");
  const domains = spell.domainAccess?.map((access) => `${words(access.domainId)} ${access.level}`).join(", ");
  const components = spell.components.filter((component) => component.required).map((component) => {
    const tradition = component.appliesToTradition ? ` (${component.appliesToTradition})` : "";
    return `${component.kind}${tradition}`;
  }).join(", ") || "None";
  const target = spell.targeting.targetText || spell.targeting.areaText || spell.targeting.effectText || spell.targeting.delivery.map(words).join(", ");
  const range = [words(spell.range.kind), spell.range.text].filter(Boolean).join(" — ");
  const duration = [words(spell.duration.kind), spell.duration.text].filter(Boolean).join(" — ");
  const save = spell.savingThrow.type === "none" ? "None" : `${words(spell.savingThrow.type)}${spell.savingThrow.outcome ? ` ${words(spell.savingThrow.outcome)}` : ""}`;
  const sr = spell.spellResistance.applies === true ? "Yes" : spell.spellResistance.applies === false ? "No" : "Special";
  const ruleParagraphs = spell.rulesText
    ?.split(/\n\s*\n/)
    .map(cleanOpenRulesParagraph)
    .filter(Boolean) ?? [];

  return (
    <article>
      <h2 className="rules-tome-heading">{spell.name}</h2>
      <div className="rules-tome-subheading">{words(spell.school)}{spell.subschool ? ` (${words(spell.subschool)})` : ""}{spell.descriptors?.length ? ` [${spell.descriptors.map(words).join(", ")}]` : ""}</div>
      <div className="rules-tome-stat"><strong>Level</strong><span>{classes}{domains ? `; ${domains} domain` : ""}</span></div>
      <div className="rules-tome-stat"><strong>Components</strong><span>{components}</span></div>
      <div className="rules-tome-stat"><strong>Casting Time</strong><span>{spell.castingTime.text || words(spell.castingTime.kind)}</span></div>
      <div className="rules-tome-stat"><strong>Range</strong><span>{range}</span></div>
      <div className="rules-tome-stat"><strong>Target / Area</strong><span>{target}</span></div>
      <div className="rules-tome-stat"><strong>Duration</strong><span>{duration}</span></div>
      <div className="rules-tome-stat"><strong>Saving Throw</strong><span>{spell.savingThrow.text || save}{spell.savingThrow.harmless && !spell.savingThrow.text ? " (harmless where applicable)" : ""}</span></div>
      <div className="rules-tome-stat"><strong>Spell Resistance</strong><span>{spell.spellResistance.text || sr}</span></div>
      <div className="rules-tome-rule" />
      {ruleParagraphs.length ? (
        ruleParagraphs.map((paragraph, index) => <p className="rules-tome-copy" key={`${spell.id}-rule-${index}`}>{paragraph}</p>)
      ) : (
        <p className="rules-tome-copy">{spell.rulesSummary}</p>
      )}
      {!ruleParagraphs.length && spell.specialRules?.map((rule) => <p className="rules-tome-copy" key={rule}>{rule}</p>)}
      {!ruleParagraphs.length && spell.components.filter((component) => component.required && component.description).map((component) => (
        <div className="rules-tome-warning" key={`${component.kind}-${component.description}`}><strong>{component.kind}:</strong> {component.description}</div>
      ))}
      {spell.executionStatus === "structured" && (
        <div className="rules-tome-warning">Canonical reference entry. Cast legality and resources are authoritative; this spell's complete outcome resolver is still being encoded server-side.</div>
      )}
      <div className="rules-tome-source">Source: {sourceLine(spell.sources)}</div>
    </article>
  );
}

function modifierText(modifier: Record<string, unknown>) {
  const target = words(String(modifier.target || "rule"));
  const operation = String(modifier.operation || "changes");
  const value = modifier.value;
  const valueText = value === undefined ? "" : ` ${typeof value === "boolean" ? (value ? "enabled" : "disabled") : String(value)}`;
  const condition = modifier.condition ? ` when ${String(modifier.condition).replace(/^./, (c) => c.toLowerCase())}` : "";
  const ruleNote = modifier.rulesNote ? ` ${String(modifier.rulesNote)}` : "";
  return `${target}: ${operation}${valueText}${condition}.${ruleNote}`;
}

function FeatPage({ feat }: { feat: PublicDnd35Feat }) {
  return (
    <article>
      <h2 className="rules-tome-heading">{feat.name}</h2>
      <div className="rules-tome-subheading">{feat.categories.map(words).join(" · ")}</div>
      {feat.prerequisiteSummary && <div className="rules-tome-stat"><strong>Prerequisite</strong><span>{feat.prerequisiteSummary}</span></div>}
      {feat.repeatable && <div className="rules-tome-stat"><strong>Special</strong><span>{feat.repeatRule || "This feat may be selected more than once under its stated restrictions."}</span></div>}
      {feat.metamagic && (
        <>
          <div className="rules-tome-stat"><strong>Spell Slot</strong><span>{feat.metamagic.slotAdjustment === "variable" ? "Variable higher-level slot" : `Uses a slot ${feat.metamagic.slotAdjustment} level${feat.metamagic.slotAdjustment === 1 ? "" : "s"} higher`}</span></div>
          <div className="rules-tome-stat"><strong>Spell Level</strong><span>{words(feat.metamagic.effectiveSpellLevel)}</span></div>
        </>
      )}
      <div className="rules-tome-rule" />
      <p className="rules-tome-copy">{feat.rulesSummary}</p>
      {feat.modifiers.map((modifier, index) => <p className="rules-tome-copy" key={`${feat.id}-modifier-${index}`}>{modifierText(modifier)}</p>)}
      {feat.metamagic?.transformations.map((modifier, index) => <p className="rules-tome-copy" key={`${feat.id}-meta-${index}`}>{modifierText(modifier)}</p>)}
      {feat.metamagic?.restrictions?.map((rule) => <div className="rules-tome-warning" key={rule}>{rule}</div>)}
      {feat.specialRules?.map((rule) => <div className="rules-tome-warning" key={rule}>{rule}</div>)}
      <div className="rules-tome-source">Source: {sourceLine(feat.sources)}</div>
    </article>
  );
}

export default function RulesTomePage({ kind }: Props) {
  const config = CONFIG[kind];
  const isFeat = kind === "feat-codex";
  const [closed, setClosed] = useState(true);
  const [query, setQuery] = useState("");
  const [spread, setSpread] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const result = useQuery<SpellResponse | FeatResponse>({ queryKey: [config.endpoint] });
  const library = useQuery<KnowledgeLibraryResponse>({ queryKey: ["/api/knowledge/library"] });

  const allEntries = useMemo(() => {
    if (!result.data) return [] as Array<PublicDnd35Spell | PublicDnd35Feat>;
    return isFeat ? (result.data as FeatResponse).feats : (result.data as SpellResponse).spells;
  }, [isFeat, result.data]);
  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allEntries;
    return allEntries.filter((entry) => [entry.name, entry.rulesSummary, ...(isFeat ? (entry as PublicDnd35Feat).categories : [(entry as PublicDnd35Spell).school])].join(" ").toLowerCase().includes(needle));
  }, [allEntries, isFeat, query]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const safeSpread = Math.min(spread, pageCount - 1);
  const visible = entries.slice(safeSpread * pageSize, safeSpread * pageSize + pageSize);
  const selected = entries.find((entry) => entry.id === selectedId) ?? visible[0] ?? allEntries[0];
  const Icon = config.icon;
  const dnd35Shelf = library.data?.shelves.find((shelf) => shelf.ruleset === "dnd35e");
  const volumeState = dnd35Shelf?.volumes.find((volume) => volume.id === config.volumeId);
  const corpusMessage = volumeState?.status === "available"
    ? `${volumeState.recordCount ?? allEntries.length} canonical records are indexed in this volume. Imported SRD rules are authoritative reference text; hand-hardened entries additionally drive executable mechanics.`
    : volumeState?.note || "Verified records are authoritative; entries not yet catalogued are deliberately absent rather than reconstructed from AI memory.";

  const leftPage = (
    <section>
      <div className="rules-tome-subheading">Dungeons & Dragons 3.5 Edition</div>
      <h1 className="rules-tome-heading">{config.title}</h1>
      <p className="rules-tome-copy">{config.subtitle}. This volume is rendered from the same canonical mechanical records used by DungeonMasterOS during play.</p>
      <div className="rules-tome-warning">{corpusMessage}</div>
      <input className="rules-tome-search" value={query} onChange={(event) => { setQuery(event.target.value); setSpread(0); setSelectedId(null); }} placeholder={`Search ${config.title.toLowerCase()}...`} aria-label={`Search ${config.title}`} />
      <div className="rules-tome-index">
        {visible.map((entry) => (
          <button type="button" key={entry.id} className={selected?.id === entry.id ? "active" : ""} onClick={() => setSelectedId(entry.id)}>
            {entry.name}
          </button>
        ))}
      </div>
      <div className="rules-tome-source">Index spread {safeSpread + 1} of {pageCount} · {entries.length} catalogued records</div>
    </section>
  );

  const rightPage = result.isLoading ? (
    <p className="rules-tome-copy">The pages settle beneath your hand...</p>
  ) : selected ? (
    isFeat ? <FeatPage feat={selected as PublicDnd35Feat} /> : <SpellPage spell={selected as PublicDnd35Spell} />
  ) : (
    <p className="rules-tome-copy">No verified entry matches this index.</p>
  );

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
      coverTitle={config.title}
      coverVolume={<>{config.volume}<br />Library of Knowledge</>}
      coverAriaLabel={`Open ${config.title}`}
      coverTitleAttribute={`Open ${config.title}`}
      coverEmblem={<Icon />}
      filterLabel={`Search ${config.title}`}
    />
  );
}
