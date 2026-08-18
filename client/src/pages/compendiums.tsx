import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { BookOpen, Library, ScrollText, Shield, Skull, Sparkles } from "lucide-react";
import type { KnowledgeLibraryResponse, KnowledgeVolume } from "@/lib/knowledge-library";
import "@/library.css";

const ICONS: Record<KnowledgeVolume["kind"], typeof BookOpen> = {
  items: Shield,
  bestiary: Skull,
  grimoire: Sparkles,
  "holy-tome": ScrollText,
  "feat-codex": BookOpen,
};

function statusLabel(volume: KnowledgeVolume) {
  if (volume.status === "available") return volume.recordCount ? `${volume.recordCount} entries` : "Open volume";
  if (volume.status === "foundation") return volume.recordCount ? `${volume.recordCount} verified records · expanding` : "Foundation · expanding";
  return "Being catalogued";
}

function Tome({ volume }: { volume: KnowledgeVolume }) {
  const [, navigate] = useLocation();
  const Icon = ICONS[volume.kind];
  const content = (
    <>
      <span className="knowledge-book-spine" aria-hidden="true" />
      <span className="knowledge-book-inner">
        <span className="knowledge-book-icon"><Icon size={25} strokeWidth={1.5} /></span>
        <span className="knowledge-book-title">{volume.title}</span>
        <span className="knowledge-book-rule" />
        <span className="knowledge-book-subtitle">{volume.subtitle}</span>
      </span>
      <span className="knowledge-book-status">{statusLabel(volume)}</span>
    </>
  );

  if (volume.href) {
    return (
      <button
        type="button"
        className="knowledge-book"
        data-kind={volume.kind}
        onClick={() => navigate(volume.href!)}
        aria-label={`Open ${volume.title}`}
        title={volume.note || volume.subtitle}
      >
        {content}
      </button>
    );
  }

  return (
    <button type="button" className="knowledge-book disabled" data-kind={volume.kind} disabled aria-label={`${volume.title}, being catalogued`} title={volume.note || "Being catalogued"}>
      {content}
    </button>
  );
}

export default function CompendiumsPage() {
  const library = useQuery<KnowledgeLibraryResponse>({ queryKey: ["/api/knowledge/library"] });

  return (
    <div className="knowledge-library">
      <header className="knowledge-library-header">
        <Link href="/" className="knowledge-library-brand">
          <span className="knowledge-library-mark"><Library size={21} /></span>
          <span>
            <span className="knowledge-library-kicker">DungeonMasterOS</span>
            <span className="knowledge-library-title">The Library of Knowledge</span>
          </span>
        </Link>
        <nav className="knowledge-library-nav" aria-label="Library navigation">
          <Link href="/compendiums">Compendiums</Link>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      <main className="knowledge-library-hall">
        <section className="knowledge-library-intro">
          <h1>The Library of Knowledge</h1>
          <p>
            The rules, creatures, spells and treasures used by DungeonMasterOS are kept here as living volumes. What you read in these books is drawn from the same canonical records the Dungeon Master consults during play.
          </p>
        </section>

        {library.isLoading && <div className="knowledge-library-note">The archivist is lighting the lamps...</div>}
        {library.isError && <div className="knowledge-library-note">The archive could not be opened. No rules have been substituted from memory.</div>}

        {library.data?.shelves.map((shelf) => (
          <section className="knowledge-shelf-section" key={shelf.id} aria-labelledby={`shelf-${shelf.id}`}>
            <div className="knowledge-edition-sign-wrap">
              <div className="knowledge-edition-sign" id={`shelf-${shelf.id}`}>{shelf.editionLabel}</div>
            </div>
            <div className="knowledge-shelf-name">{shelf.title}</div>
            <div className="knowledge-books">
              {shelf.volumes.map((volume) => <Tome key={volume.id} volume={volume} />)}
            </div>
            <div className="knowledge-shelf-board" aria-hidden="true" />
            <div className="knowledge-shelf-shadow" aria-hidden="true" />
          </section>
        ))}

        <aside className="knowledge-library-note">
          Edition shelves are mechanically isolated. A D&D 3.5 campaign consults only the 3.5 rules library; a 5th Edition campaign consults only its own shelf. Volumes marked “being catalogued” are intentionally unavailable until their canonical corpus is ready rather than being filled from AI memory.
        </aside>
      </main>
    </div>
  );
}
