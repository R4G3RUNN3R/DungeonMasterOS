/**
 * StatGenWizard — D&D 5e stat generation with three official methods
 *
 * Method 1: Dice Roll     — 4d6 drop lowest per ability, re-rollable individually
 * Method 2: Point Buy     — 27 points, D&D 5e cost table (8-15 range)
 * Method 3: Standard Array — 15,14,13,12,10,8 assigned to abilities
 *
 * All three output the same structure: Record<Ability, number>
 * which feeds into the character creation form and triggers the full cascade.
 */

import { useState, useCallback } from "react";
import { type Ability, ABILITIES, SKILL_ABILITY } from "@/lib/computedStats";
import { Dices, RefreshCw, Check, ChevronRight } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const ABILITY_DESCRIPTIONS: Record<Ability, string> = {
  str: "Athletics · Melee attacks · Carrying capacity",
  dex: "Acrobatics · Stealth · Ranged attacks · AC · Initiative",
  con: "HP per level · Concentration · CON saves",
  int: "Arcana · History · Investigation · Wizard spells",
  wis: "Perception · Insight · Survival · Cleric/Druid spells",
  cha: "Persuasion · Deception · Bard/Paladin/Warlock spells",
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// D&D 5e point buy cost table (score → cost in points)
const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
const POINT_BUY_TOTAL = 27;

// ── Dice utilities ────────────────────────────────────────────────────────

function roll4d6DropLowest(): { rolls: number[]; result: number } {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  const sorted = [...rolls].sort((a, b) => b - a);
  const result = sorted.slice(0, 3).reduce((s, n) => s + n, 0);
  return { rolls, result };
}

function modStr(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

// ── Parchment palette ─────────────────────────────────────────────────────
const C = {
  paper:     "#f4e9c9",
  paperDark: "#e8d49e",
  ink:       "#1a0f00",
  inkMid:    "#4a2e0e",
  inkLight:  "#8a6830",
  inkFaint:  "#c4a87a",
  crimson:   "#7a1515",
  gold:      "#b8880a",
  green:     "#1a5c1a",
  purple:    "#5a1a80",
  border:    "#c4a265",
  borderDark:"#9a7835",
};

// ── Stat colours by score ─────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 18) return "#7a1515";  // legendary
  if (score >= 16) return "#5a1a80";  // exceptional
  if (score >= 14) return "#1a3a7a";  // good
  if (score >= 12) return "#1a5c1a";  // above average
  if (score >= 10) return C.inkMid;   // average
  if (score >= 8)  return "#b8880a";  // below average
  return "#8b1a1a";                    // dump stat
}

// ── Types ─────────────────────────────────────────────────────────────────
type Method = "roll" | "pointbuy" | "array";

interface RollState {
  [K: string]: { rolls: number[]; result: number } | undefined;
}

interface Props {
  onComplete: (scores: Record<Ability, number>) => void;
  onCancel: () => void;
}

// ── Method selector ───────────────────────────────────────────────────────
function MethodButton({ active, label, description, icon, onClick }: {
  active: boolean; label: string; description: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", padding: "10px 12px",
      borderRadius: 8,
      border: `2px solid ${active ? C.gold : C.border + "66"}`,
      background: active ? `${C.gold}18` : "transparent",
      cursor: "pointer", transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ color: active ? C.gold : C.inkFaint, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: active ? C.gold : C.inkMid, fontFamily: "serif", letterSpacing: "0.04em" }}>{label}</div>
          <div style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic" }}>{description}</div>
        </div>
        {active && <Check size={12} color={C.gold} style={{ marginLeft: "auto" }} />}
      </div>
    </button>
  );
}

// ── Ability score display card ─────────────────────────────────────────────
function AbilityCard({ ab, score, children, highlight }: {
  ab: Ability; score: number; children?: React.ReactNode; highlight?: boolean;
}) {
  const color = scoreColor(score);
  return (
    <div style={{
      borderRadius: 8,
      border: `2px solid ${highlight ? C.gold : C.border}`,
      background: highlight ? `${C.gold}12` : C.paperDark,
      padding: "8px 6px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      transition: "all 0.2s",
      boxShadow: highlight ? `0 0 12px ${C.gold}44` : "none",
    }}>
      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.12em", color: C.crimson, textTransform: "uppercase", fontFamily: "serif" }}>
        {ab.toUpperCase()}
      </span>
      {/* Score box */}
      <div style={{
        width: 48, height: 52,
        border: `2px solid ${color}88`,
        borderRadius: "6px 6px 20px 20px",
        background: C.paper,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        boxShadow: score >= 16 ? `0 0 8px ${color}44` : "none",
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "serif", lineHeight: 1 }}>{score || "—"}</span>
        {score > 0 && <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "serif" }}>{modStr(score)}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Roll method ───────────────────────────────────────────────────────────
function RollMethod({ scores, onChange }: { scores: Record<Ability, number>; onChange: (scores: Record<Ability, number>) => void }) {
  const [rollHistory, setRollHistory] = useState<RollState>({});
  const [rolling, setRolling] = useState<Ability | null>(null);

  const rollOne = useCallback((ab: Ability) => {
    setRolling(ab);
    // Quick animation effect via timeout
    let count = 0;
    const interval = setInterval(() => {
      const fake = roll4d6DropLowest();
      onChange({ ...scores, [ab]: fake.result });
      count++;
      if (count >= 8) {
        clearInterval(interval);
        const final = roll4d6DropLowest();
        setRollHistory(h => ({ ...h, [ab]: final }));
        onChange({ ...scores, [ab]: final.result });
        setRolling(null);
      }
    }, 80);
  }, [scores, onChange]);

  const rollAll = useCallback(() => {
    const newScores = { ...scores };
    const newHistory: RollState = {};
    for (const ab of ABILITIES) {
      const r = roll4d6DropLowest();
      newScores[ab] = r.result;
      newHistory[ab] = r;
    }
    setRollHistory(newHistory);
    onChange(newScores);
  }, [scores, onChange]);

  const total = ABILITIES.reduce((s, ab) => s + (scores[ab] || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: C.inkFaint, fontFamily: "serif" }}>
          4d6 drop lowest per ability. Click a die to reroll individually.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: total >= 72 ? C.green : total >= 60 ? C.inkMid : C.inkFaint, fontFamily: "serif" }}>
            Total: {total}
          </span>
          <button onClick={rollAll} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
            borderRadius: 6, border: `1px solid ${C.gold}`, background: `${C.gold}18`,
            color: C.gold, fontSize: 9, fontWeight: 700, fontFamily: "serif", cursor: "pointer",
          }}>
            <Dices size={10} /> Roll All
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {ABILITIES.map(ab => {
          const hist = rollHistory[ab];
          const isRolling = rolling === ab;
          return (
            <AbilityCard key={ab} ab={ab} score={scores[ab] || 0} highlight={isRolling}>
              {/* Individual dice rolls display */}
              {hist && !isRolling && (
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                  {hist.rolls.map((d, i) => {
                    const dropped = [...hist.rolls].sort((a,b) => b-a).slice(3).includes(d) && !([...hist.rolls].sort((a,b) => b-a).slice(0,3).includes(d));
                    // highlight which die was dropped
                    const sortedDesc = [...hist.rolls].sort((a,b) => b-a);
                    const kept = sortedDesc.slice(0,3);
                    const isDropped = i === hist.rolls.indexOf(Math.min(...hist.rolls));
                    return (
                      <div key={i} style={{
                        width: 14, height: 14,
                        borderRadius: 3,
                        background: isDropped ? "#8b1a1a22" : `${C.gold}22`,
                        border: `1px solid ${isDropped ? "#8b1a1a55" : C.gold + "55"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 700,
                        color: isDropped ? "#8b1a1a88" : C.gold,
                        textDecoration: isDropped ? "line-through" : "none",
                      }}>
                        {d}
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={() => rollOne(ab)} style={{
                background: "none", border: `1px solid ${C.border}55`, borderRadius: 4,
                cursor: "pointer", padding: "1px 6px", fontSize: 8, color: C.inkFaint,
                display: "flex", alignItems: "center", gap: 2,
              }}>
                <RefreshCw size={7} /> Reroll
              </button>
            </AbilityCard>
          );
        })}
      </div>

      <p style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", textAlign: "center", marginTop: 10 }}>
        Total {total} · {total >= 72 ? "Exceptional rolls!" : total >= 65 ? "Good rolls" : total >= 55 ? "Average" : "Tough but fair"}
      </p>
    </div>
  );
}

// ── Point Buy method ──────────────────────────────────────────────────────
function PointBuyMethod({ scores, onChange }: { scores: Record<Ability, number>; onChange: (s: Record<Ability, number>) => void }) {
  const spent = ABILITIES.reduce((s, ab) => s + (POINT_BUY_COST[scores[ab]] ?? 0), 0);
  const remaining = POINT_BUY_TOTAL - spent;

  const adjust = (ab: Ability, delta: number) => {
    const current = scores[ab];
    const next = current + delta;
    if (next < 8 || next > 15) return;
    const newCost = POINT_BUY_COST[next] ?? 0;
    const currentCost = POINT_BUY_COST[current] ?? 0;
    const costDelta = newCost - currentCost;
    if (remaining - costDelta < 0) return;
    onChange({ ...scores, [ab]: next });
  };

  return (
    <div>
      {/* Points remaining banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px", marginBottom: 12,
        borderRadius: 6,
        background: remaining === 0 ? `${C.green}18` : remaining < 5 ? `${C.gold}18` : `${C.purple}18`,
        border: `1px solid ${remaining === 0 ? C.green : remaining < 5 ? C.gold : C.purple}55`,
      }}>
        <span style={{ fontSize: 10, fontFamily: "serif", color: C.inkMid }}>Points remaining</span>
        <span style={{ fontSize: 18, fontWeight: 900, fontFamily: "serif", color: remaining === 0 ? C.green : remaining < 5 ? C.gold : C.purple }}>
          {remaining} <span style={{ fontSize: 10, fontWeight: 400 }}>/ {POINT_BUY_TOTAL}</span>
        </span>
      </div>

      {/* Point buy cost guide */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(POINT_BUY_COST).map(([score, cost]) => (
          <div key={score} style={{ textAlign: "center", fontSize: 8, fontFamily: "serif" }}>
            <div style={{ fontWeight: 700, color: scoreColor(Number(score)) }}>{score}</div>
            <div style={{ color: C.inkFaint }}>{cost}pt</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {ABILITIES.map(ab => {
          const score = scores[ab];
          const cost = POINT_BUY_COST[score] ?? 0;
          return (
            <div key={ab} style={{
              borderRadius: 8, border: `1.5px solid ${C.border}`,
              background: C.paperDark, padding: "8px 10px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {/* Ability name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.crimson, fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {ab.toUpperCase()}
                </div>
                <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif" }}>
                  {ABILITY_DESCRIPTIONS[ab].split(" · ")[0]}
                </div>
              </div>

              {/* −  score  + */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                <button onClick={() => adjust(ab, -1)} disabled={score <= 8}
                  style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: score <= 8 ? "transparent" : C.paper, cursor: score <= 8 ? "not-allowed" : "pointer", fontSize: 12, color: score <= 8 ? C.inkFaint : C.inkMid, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  −
                </button>
                <div style={{ textAlign: "center", minWidth: 32 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(score), fontFamily: "serif", lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: 9, color: scoreColor(score), fontFamily: "serif" }}>{modStr(score)}</div>
                </div>
                <button onClick={() => adjust(ab, 1)} disabled={score >= 15 || remaining - (POINT_BUY_COST[score + 1] - cost) < 0}
                  style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${C.border}`, background: (score >= 15 || remaining <= 0) ? "transparent" : C.paper, cursor: (score >= 15 || remaining <= 0) ? "not-allowed" : "pointer", fontSize: 12, color: (score >= 15 || remaining <= 0) ? C.inkFaint : C.inkMid, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  +
                </button>
              </div>

              {/* Cost */}
              <div style={{ fontSize: 8, color: C.gold, fontFamily: "serif", width: 24, textAlign: "right" }}>
                {cost}pt
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Standard Array method ─────────────────────────────────────────────────
function StandardArrayMethod({ scores, onChange }: { scores: Record<Ability, number>; onChange: (s: Record<Ability, number>) => void }) {
  // Track which standard array values have been assigned where
  const assignedValues = Object.values(scores).filter(v => STANDARD_ARRAY.includes(v));
  const [dragging, setDragging] = useState<number | null>(null); // value being dragged

  const assign = (ab: Ability, value: number) => {
    // If this value is already assigned elsewhere, swap
    const prevAb = ABILITIES.find(a => scores[a] === value && a !== ab);
    const newScores = { ...scores };
    if (prevAb) newScores[prevAb] = scores[ab]; // put current score where the dragged one came from
    newScores[ab] = value;
    onChange(newScores);
  };

  const remaining = STANDARD_ARRAY.filter(v => !assignedValues.includes(v) ||
    assignedValues.filter(x => x === v).length < STANDARD_ARRAY.filter(x => x === v).length
  );

  // Available (unassigned) values
  const usedCounts: Record<number, number> = {};
  assignedValues.forEach(v => { usedCounts[v] = (usedCounts[v] || 0) + 1; });
  const available = STANDARD_ARRAY.filter((v, i) => {
    const totalCount = STANDARD_ARRAY.filter(x => x === v).length;
    return (usedCounts[v] || 0) < totalCount;
  });
  // Deduplicate
  const availableUniq = [...new Set(available)];

  return (
    <div>
      <p style={{ fontSize: 9, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", marginBottom: 12 }}>
        Assign the six standard values to your abilities. Click a value below, then click an ability to assign it.
      </p>

      {/* Available values */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: C.inkMid, fontFamily: "serif", alignSelf: "center" }}>Available:</span>
        {availableUniq.length > 0 ? availableUniq.map(v => (
          <button key={v} onClick={() => setDragging(dragging === v ? null : v)}
            style={{
              padding: "4px 12px", borderRadius: 6,
              border: `2px solid ${dragging === v ? C.gold : C.border}`,
              background: dragging === v ? `${C.gold}22` : C.paperDark,
              fontSize: 14, fontWeight: 900, color: dragging === v ? C.gold : scoreColor(v),
              fontFamily: "serif", cursor: "pointer",
              boxShadow: dragging === v ? `0 0 10px ${C.gold}44` : "none",
            }}>
            {v}
            <span style={{ fontSize: 9, marginLeft: 3, fontWeight: 400, color: dragging === v ? C.gold : C.inkFaint }}>({modStr(v)})</span>
          </button>
        )) : (
          <span style={{ fontSize: 9, color: C.green, fontFamily: "serif", fontWeight: 700 }}>✓ All values assigned</span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {ABILITIES.map(ab => {
          const score = scores[ab];
          const isAssigned = STANDARD_ARRAY.includes(score);
          const canAssign = dragging !== null;
          return (
            <div key={ab}
              onClick={() => { if (dragging !== null) { assign(ab, dragging); setDragging(null); } }}
              style={{
                borderRadius: 8,
                border: `2px solid ${canAssign ? C.gold + "88" : isAssigned ? C.border : C.border + "44"}`,
                background: canAssign ? `${C.gold}0a` : C.paperDark,
                padding: "8px 6px",
                textAlign: "center",
                cursor: canAssign ? "pointer" : "default",
                transition: "all 0.15s",
              }}>
              <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.12em", color: C.crimson, textTransform: "uppercase", fontFamily: "serif", marginBottom: 4 }}>
                {ab.toUpperCase()}
              </div>
              <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 6 }}>
                {ABILITY_DESCRIPTIONS[ab].split(" · ")[0]}
              </div>
              {isAssigned ? (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(score), fontFamily: "serif", lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: scoreColor(score), fontFamily: "serif" }}>{modStr(score)}</div>
                  {canAssign && <div style={{ fontSize: 7.5, color: C.gold, fontFamily: "serif", marginTop: 3 }}>Click to swap</div>}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: C.inkFaint + "88", fontFamily: "serif" }}>
                  {canAssign ? `Assign ${dragging}` : "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stat summary footer ───────────────────────────────────────────────────
function StatSummary({ scores }: { scores: Record<Ability, number> }) {
  const profBonus = 2; // level 1
  const skillsByAb = Object.entries(SKILL_ABILITY).reduce((acc, [skill, ab]) => {
    if (!acc[ab]) acc[ab] = [];
    acc[ab].push(skill);
    return acc;
  }, {} as Record<Ability, string[]>);

  return (
    <div style={{
      background: C.paper,
      border: `1.5px solid ${C.border}`,
      borderRadius: 8, padding: "10px 12px",
      marginTop: 12,
    }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, color: C.crimson, fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
        Derived Stats Preview
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px 12px" }}>
        {ABILITIES.map(ab => {
          const score = scores[ab];
          const mod = Math.floor((score - 10) / 2);
          const skills = skillsByAb[ab] || [];
          const skillBonuses = skills.map(s => `${s} ${mod >= 0 ? "+" : ""}${mod}`).join(", ");
          return (
            <div key={ab} style={{ borderBottom: `1px solid ${C.border}33`, paddingBottom: 4, marginBottom: 2 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.crimson, fontFamily: "serif", minWidth: 24, textTransform: "uppercase" }}>{ab}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: scoreColor(score), fontFamily: "serif" }}>{score}</span>
                <span style={{ fontSize: 9, color: scoreColor(score), fontFamily: "serif" }}>({modStr(score)})</span>
              </div>
              <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", lineHeight: 1.4 }}>
                {skillBonuses}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>
          Initiative: <strong style={{ color: scoreColor(scores.dex) }}>{modStr(scores.dex)}</strong>
        </div>
        <div style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>
          Carry: <strong style={{ color: C.ink }}>{scores.str * 15} lb</strong>
        </div>
        <div style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>
          Passive Perception: <strong style={{ color: C.ink }}>{10 + Math.floor((scores.wis - 10) / 2)}</strong>
        </div>
        <div style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>
          HP (Lv1 avg): <strong style={{ color: C.crimson }}>~{8 + Math.floor((scores.con - 10) / 2)}</strong>
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────
const DEFAULT_SCORES: Record<Ability, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const ARRAY_DEFAULTS: Record<Ability, number> = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

export default function StatGenWizard({ onComplete, onCancel }: Props) {
  const [method, setMethod] = useState<Method>("roll");
  const [scores, setScores] = useState<Record<Ability, number>>(DEFAULT_SCORES);

  const handleMethodChange = (m: Method) => {
    setMethod(m);
    if (m === "array") setScores(ARRAY_DEFAULTS);
    else if (m === "pointbuy") setScores({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
    else setScores(DEFAULT_SCORES);
  };

  const isReady = ABILITIES.every(ab => scores[ab] > 0);

  return (
    <div style={{
      background: `linear-gradient(160deg, #f4e9c9 0%, #e8d49e 100%)`,
      border: `2px solid ${C.borderDark}`,
      borderRadius: 12,
      padding: 20,
      maxWidth: 560,
      width: "100%",
      maxHeight: "85vh",
      overflowY: "auto",
      scrollbarWidth: "thin",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${C.crimson}, ${C.crimson}, transparent)`, borderRadius: 1, marginBottom: 10 }} />
        <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, fontFamily: "serif", letterSpacing: "0.04em" }}>
          Generate Ability Scores
        </div>
        <p style={{ fontSize: 9.5, color: C.inkMid, fontFamily: "serif", marginTop: 3 }}>
          Choose your method. All skills, saves, HP, AC, and spellcasting stats will cascade from these values automatically.
        </p>
      </div>

      {/* Method selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        <MethodButton active={method === "roll"} label="🎲 Dice Roll (4d6 drop lowest)" description="Roll four dice per ability, drop the lowest. More random, potentially exceptional." icon={<Dices size={14} />} onClick={() => handleMethodChange("roll")} />
        <MethodButton active={method === "pointbuy"} label="⚖️ Point Buy" description="27 points to distribute. Balanced — no dump stat surprises, no lucky high rolls." icon={<span style={{ fontSize: 12 }}>⚖️</span>} onClick={() => handleMethodChange("pointbuy")} />
        <MethodButton active={method === "array"} label="📋 Standard Array" description="15, 14, 13, 12, 10, 8 — assign to taste. Consistent across all players." icon={<span style={{ fontSize: 12 }}>📋</span>} onClick={() => handleMethodChange("array")} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`, marginBottom: 14 }} />

      {/* Method panel */}
      {method === "roll" && <RollMethod scores={scores} onChange={setScores} />}
      {method === "pointbuy" && <PointBuyMethod scores={scores} onChange={setScores} />}
      {method === "array" && <StandardArrayMethod scores={scores} onChange={setScores} />}

      {/* Summary */}
      {isReady && <StatSummary scores={scores} />}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
          background: "transparent", border: `1.5px solid ${C.border}`,
          color: C.inkMid, fontSize: 11, fontFamily: "serif", fontWeight: 700,
        }}>
          Back
        </button>
        <button
          onClick={() => isReady && onComplete(scores)}
          disabled={!isReady}
          style={{
            flex: 2, padding: "10px", borderRadius: 8, cursor: isReady ? "pointer" : "not-allowed",
            background: isReady ? `linear-gradient(135deg, ${C.gold}, ${C.borderDark})` : C.border + "33",
            border: `1.5px solid ${isReady ? C.gold : C.border + "44"}`,
            color: isReady ? C.ink : C.inkFaint, fontSize: 11, fontFamily: "serif", fontWeight: 900,
            letterSpacing: "0.06em", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          Use These Stats <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
