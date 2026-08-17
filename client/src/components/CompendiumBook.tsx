import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import "@/compendium.css";

type TurnDirection = "next" | "prev";

interface CompendiumBookProps {
  leftPage: ReactNode;
  rightPage: ReactNode;
  leftPageNumber: number;
  rightPageNumber: number;
  mobileSide?: 0 | 1;
  canPrevious?: boolean;
  canNext?: boolean;
  onTurn?: (direction: TurnDirection) => void;
  onFilters?: () => void;
  filterLabel?: string;
  children?: ReactNode;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "select" || tag === "textarea" || target.isContentEditable;
}

export default function CompendiumBook({
  leftPage,
  rightPage,
  leftPageNumber,
  rightPageNumber,
  mobileSide = 0,
  canPrevious = false,
  canNext = false,
  onTurn,
  onFilters,
  filterLabel = "Search & Filters",
  children,
}: CompendiumBookProps) {
  const [turning, setTurning] = useState<TurnDirection | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const turnTimer = useRef<number | null>(null);
  const finishTimer = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const triggerTurn = useCallback(
    (direction: TurnDirection) => {
      if (!onTurn || turning) return;
      if (direction === "prev" && !canPrevious) return;
      if (direction === "next" && !canNext) return;

      setTurning(direction);
      turnTimer.current = window.setTimeout(() => onTurn(direction), 175);
      finishTimer.current = window.setTimeout(() => setTurning(null), 365);
    },
    [canNext, canPrevious, onTurn, turning],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft") triggerTurn("prev");
      if (event.key === "ArrowRight") triggerTurn("next");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [triggerTurn]);

  useEffect(
    () => () => {
      if (turnTimer.current) window.clearTimeout(turnTimer.current);
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
    },
    [],
  );

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 45) return;
    triggerTurn(delta < 0 ? "next" : "prev");
  };

  return (
    <div className="compendium-root">
      <header className="compendium-sitebar">
        <Link href="/" className="compendium-brand" aria-label="DungeonMasterOS home">
          <span className="compendium-brand-mark"><BookOpen size={19} /></span>
          <span>
            <span className="compendium-brand-kicker">Reference Library</span>
            <span className="compendium-brand-title">DungeonMasterOS Compendium</span>
          </span>
        </Link>
        <nav className="compendium-nav" aria-label="Compendium navigation">
          <Link href="/compendium" className="keep-mobile">Compendium</Link>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/dashboard">Dashboard</Link>
          {onFilters && (
            <button type="button" className="compendium-filter-trigger" onClick={onFilters}>
              <SlidersHorizontal size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
              {filterLabel}
            </button>
          )}
        </nav>
      </header>

      <main className="compendium-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          type="button"
          className="compendium-page-edge prev"
          onClick={() => triggerTurn("prev")}
          disabled={!canPrevious || Boolean(turning)}
          aria-label="Turn to the previous page"
          title="Previous page (Left Arrow)"
        >
          <ChevronLeft />
        </button>

        <div className="compendium-tome" aria-label="Open compendium book">
          <section className={`compendium-page-sheet left ${isMobile && mobileSide === 1 ? "mobile-hidden" : ""}`}>
            <div className="compendium-page-inner">{leftPage}</div>
            <span className="compendium-page-number">{leftPageNumber}</span>
          </section>
          <section className={`compendium-page-sheet right ${isMobile && mobileSide === 0 ? "mobile-hidden" : ""}`}>
            <div className="compendium-page-inner">{rightPage}</div>
            <span className="compendium-page-number">{rightPageNumber}</span>
          </section>
          {turning && <div className={`compendium-turn-sheet ${turning}`} aria-hidden="true" />}
        </div>

        <button
          type="button"
          className="compendium-page-edge next"
          onClick={() => triggerTurn("next")}
          disabled={!canNext || Boolean(turning)}
          aria-label="Turn to the next page"
          title="Next page (Right Arrow)"
        >
          <ChevronRight />
        </button>
      </main>

      <div className="compendium-mobile-turns" aria-label="Page navigation">
        <button type="button" onClick={() => triggerTurn("prev")} disabled={!canPrevious || Boolean(turning)} aria-label="Previous page">
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={() => triggerTurn("next")} disabled={!canNext || Boolean(turning)} aria-label="Next page">
          <ChevronRight size={20} />
        </button>
      </div>

      {children}
    </div>
  );
}
