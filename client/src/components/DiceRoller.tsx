/**
 * DiceRoller — animated 3D dice for Dungeon Master OS
 *
 * Inspired by: Foundry VTT "Dice So Nice", D&D Beyond shared 3D dice,
 * and Owlbear Rodeo physics-synced dice.
 *
 * Implementation:
 * - CSS 3D transforms for each die face (no WebGL dependency, crisp at any size)
 * - Physics-feel arc: toss upward, spin on 3 axes, land with bounce
 * - Each die type (d4, d6, d8, d10, d12, d20, d100) has correct face counts
 * - Crit (natural max) and fumble (natural 1) have special flash animations
 * - Multiple dice can be thrown simultaneously
 * - Results announced with parchment-style notification
 * - Can be triggered manually (roller tray) or automatically from DM text
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Dices, X, RotateCcw } from "lucide-react";

// ── Die configurations ────────────────────────────────────────────────────
export const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieType = typeof DIE_TYPES[number];

const DIE_CONFIG: Record<DieType, { faces: number; label: string; color: string }> = {
  4:   { faces: 4,   label: "d4",   color: "#c0392b" },
  6:   { faces: 6,   label: "d6",   color: "#2980b9" },
  8:   { faces: 8,   label: "d8",   color: "#8e44ad" },
  10:  { faces: 10,  label: "d10",  color: "#16a085" },
  12:  { faces: 12,  label: "d12",  color: "#d35400" },
  20:  { faces: 20,  label: "d20",  color: "#27ae60" },
  100: { faces: 100, label: "d%",   color: "#7f8c8d" },
};

// ── Utility ───────────────────────────────────────────────────────────────
function rollDie(faces: number): number {
  return Math.floor(Math.random() * faces) + 1;
}

function isCrit(result: number, faces: number) { return result === faces; }
function isFumble(result: number) { return result === 1; }

// ── CSS 3D d6 — the centrepiece visual die ────────────────────────────────
// For non-cube dice we show a stylised polygon face
const D6_FACES = ["⚀","⚁","⚂","⚃","⚄","⚅"];

// Rotation maps: face value → [rotateX, rotateY] so that face is front-facing
const D6_ROTATIONS: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0, -90],
  3: [90, 0],
  4: [-90, 0],
  5: [0, 90],
  6: [0, 180],
};

interface SingleDie3D {
  id: string;
  type: DieType;
  result: number;
  rolling: boolean;
  bounced: boolean;
  // random throw parameters
  spinX: number;
  spinY: number;
  spinZ: number;
  arcHeight: number;
  landDelay: number; // ms offset for staggered multi-dice
}

interface RollResult {
  dice: Array<{ type: DieType; result: number }>;
  total: number;
  modifier: number;
  label: string;
  isCrit: boolean;
  isFumble: boolean;
}

// ── Die face component (CSS 3D cube for d6, styled polygon for others) ────
function Die3D({ die, size = 56 }: { die: SingleDie3D; size?: number }) {
  const cfg = DIE_CONFIG[die.type];
  const [displayRotation, setDisplayRotation] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!die.rolling) {
      if (die.type === 6) {
        const [rx, ry] = D6_ROTATIONS[die.result] || [0, 0];
        setDisplayRotation({ x: rx, y: ry });
      }
    }
  }, [die.rolling, die.result, die.type]);

  const crit = isCrit(die.result, cfg.faces);
  const fumble = isFumble(die.result);

  const glowColor = crit ? "#ffd700" : fumble ? "#ff3333" : "transparent";
  const glowSize = (crit || fumble) && !die.rolling ? "0 0 20px 6px" : "none";

  if (die.type === 6) {
    // Full CSS 3D cube
    const s = size;
    const half = s / 2;
    const finalRX = die.rolling ? die.spinX : displayRotation.x;
    const finalRY = die.rolling ? die.spinY : displayRotation.y;

    const faces = [
      { rot: "rotateY(0deg)",    val: 1 },
      { rot: "rotateY(90deg)",   val: 5 },
      { rot: "rotateY(180deg)",  val: 6 },
      { rot: "rotateY(-90deg)",  val: 2 },
      { rot: "rotateX(90deg)",   val: 4 },
      { rot: "rotateX(-90deg)",  val: 3 },
    ];

    return (
      <div style={{
        width: s, height: s,
        perspective: 300,
        filter: `drop-shadow(${glowSize} ${glowColor})`,
        transition: "filter 0.3s",
      }}>
        <div style={{
          width: "100%", height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${finalRX}deg) rotateY(${finalRY}deg)`,
          transition: die.rolling ? "none" : "transform 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)",
        }}>
          {faces.map(({ rot, val }) => (
            <div key={val} style={{
              position: "absolute",
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${cfg.color}dd, ${cfg.color}88)`,
              border: "2px solid rgba(255,255,255,0.25)",
              borderRadius: 8,
              transform: `${rot} translateZ(${half}px)`,
              fontSize: s * 0.42,
              userSelect: "none",
              backfaceVisibility: "hidden",
            }}>
              {D6_FACES[val - 1]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For non-d6 dice: stylised flat polygon with the number
  const shapes: Record<DieType, string> = {
    4:   "polygon(50% 0%, 100% 100%, 0% 100%)",
    8:   "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
    10:  "polygon(50% 0%, 100% 35%, 85% 100%, 15% 100%, 0% 35%)",
    12:  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
    20:  "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
    100: "circle(50%)",
    6:   "none",
  };

  const spinAnim = die.rolling ? `spin-${die.id}` : "none";

  return (
    <div style={{
      width: size, height: size,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      <div style={{
        width: size * 0.9, height: size * 0.9,
        clipPath: shapes[die.type],
        background: `linear-gradient(135deg, ${cfg.color}ee, ${cfg.color}99)`,
        border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: die.rolling ? "none" : (crit || fumble) ? `0 0 16px 4px ${glowColor}` : `0 4px 12px rgba(0,0,0,0.4)`,
        transition: "box-shadow 0.3s",
        animation: die.rolling
          ? `roll-spin-${die.id} 0.1s linear infinite`
          : die.bounced ? "none" : undefined,
      }}>
        {!die.rolling && (
          <span style={{
            color: "white",
            fontWeight: 900,
            fontSize: size * (die.result >= 10 ? 0.28 : 0.36),
            fontFamily: "serif",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
            letterSpacing: "-0.02em",
          }}>
            {die.result}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Roll result banner ────────────────────────────────────────────────────
function ResultBanner({ roll, onClose }: { roll: RollResult; onClose: () => void }) {
  const crit = roll.isCrit;
  const fumble = roll.isFumble;

  return (
    <div style={{
      background: crit ? "linear-gradient(135deg, #1a0f00, #3a2000)" :
                  fumble ? "linear-gradient(135deg, #1a0000, #3a0000)" :
                  "linear-gradient(135deg, #1a1108, #2a1e08)",
      border: `2px solid ${crit ? "#ffd700" : fumble ? "#cc0000" : "#c4a265"}`,
      borderRadius: 10,
      padding: "12px 16px",
      textAlign: "center",
      position: "relative",
      boxShadow: crit ? "0 0 30px rgba(255,215,0,0.3)" :
                 fumble ? "0 0 30px rgba(255,0,0,0.2)" : "none",
    }}>
      <button onClick={onClose} style={{
        position: "absolute", top: 6, right: 8,
        background: "none", border: "none", cursor: "pointer",
        color: "#8a6830", fontSize: 14,
      }}>✕</button>

      {crit && (
        <div style={{ fontSize: 11, fontWeight: 900, color: "#ffd700", fontFamily: "serif", letterSpacing: "0.2em", marginBottom: 4, textTransform: "uppercase" }}>
          ★ Critical! ★
        </div>
      )}
      {fumble && (
        <div style={{ fontSize: 11, fontWeight: 900, color: "#cc0000", fontFamily: "serif", letterSpacing: "0.2em", marginBottom: 4, textTransform: "uppercase" }}>
          ✦ Fumble ✦
        </div>
      )}

      <div style={{ fontSize: 13, color: "#c4a87a", fontFamily: "serif", marginBottom: 6 }}>{roll.label}</div>

      <div style={{
        fontSize: 48, fontWeight: 900, fontFamily: "serif",
        color: crit ? "#ffd700" : fumble ? "#cc3333" : "#f4e9c9",
        lineHeight: 1,
        textShadow: crit ? "0 0 20px rgba(255,215,0,0.8)" : fumble ? "0 0 20px rgba(200,0,0,0.6)" : "none",
      }}>
        {roll.total}
      </div>

      {roll.dice.length > 1 && (
        <div style={{ fontSize: 10, color: "#8a6830", fontFamily: "serif", marginTop: 4 }}>
          [{roll.dice.map(d => d.result).join(" + ")}]{roll.modifier !== 0 ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}` : ""}
        </div>
      )}
    </div>
  );
}

// ── Dice tray ────────────────────────────────────────────────────────────
interface TrayState {
  queue: Array<{ type: DieType; count: number }>;
  modifier: number;
}

// ── Main DiceRoller component ─────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onResult?: (result: RollResult) => void;
  // Auto-trigger from DM text: pass a detected roll formula like "2d6+3"
  autoRoll?: { formula: string; label: string } | null;
}

export default function DiceRoller({ isOpen, onClose, onResult, autoRoll }: Props) {
  const [dice, setDice] = useState<SingleDie3D[]>([]);
  const [currentRoll, setCurrentRoll] = useState<RollResult | null>(null);
  const [tray, setTray] = useState<TrayState>({ queue: [], modifier: 0 });
  const [showResult, setShowResult] = useState(false);
  const rollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { rollTimers.current.forEach(clearTimeout); rollTimers.current = []; };

  // ── Perform a roll ──────────────────────────────────────────────────────
  const performRoll = useCallback((diceList: Array<{ type: DieType; count: number }>, modifier = 0, label = "") => {
    clearTimers();
    setShowResult(false);
    setCurrentRoll(null);

    // Generate results
    const results: Array<{ type: DieType; result: number }> = [];
    for (const { type, count } of diceList) {
      for (let i = 0; i < Math.min(count, 12); i++) { // cap at 12 dice visually
        results.push({ type, result: rollDie(DIE_CONFIG[type].faces) });
      }
    }
    if (results.length === 0) return;

    const total = results.reduce((s, d) => s + d.result, 0) + modifier;
    const mainDie = results[0];
    const crit = results.length === 1 && isCrit(mainDie.result, DIE_CONFIG[mainDie.type].faces);
    const fumble = results.length === 1 && isFumble(mainDie.result);

    const rollResult: RollResult = {
      dice: results,
      total,
      modifier,
      label: label || results.map(d => `d${d.type}`).join("+") + (modifier ? `${modifier > 0 ? "+" : ""}${modifier}` : ""),
      isCrit: crit,
      isFumble: fumble,
    };

    // Create animated dice objects
    const animated: SingleDie3D[] = results.map((r, i) => ({
      id: `die-${Date.now()}-${i}`,
      type: r.type,
      result: r.result,
      rolling: true,
      bounced: false,
      spinX: (Math.random() * 1440 - 720) + (r.result * 36),
      spinY: (Math.random() * 1440 - 720) + (r.result * 18),
      spinZ: (Math.random() * 360 - 180),
      arcHeight: 0.6 + Math.random() * 0.4,
      landDelay: i * 150,
    }));

    setDice(animated);

    // Land each die sequentially
    animated.forEach((die, i) => {
      const landTimer = setTimeout(() => {
        setDice(prev => prev.map(d => d.id === die.id ? { ...d, rolling: false } : d));
        if (i === animated.length - 1) {
          // All dice landed — bounce then show result
          const bounceTimer = setTimeout(() => {
            setDice(prev => prev.map(d => ({ ...d, bounced: true })));
            setCurrentRoll(rollResult);
            setShowResult(true);
            onResult?.(rollResult);
          }, 400);
          rollTimers.current.push(bounceTimer);
        }
      }, 800 + die.landDelay);
      rollTimers.current.push(landTimer);
    });
  }, [onResult]);

  // Auto-roll from DM formula
  useEffect(() => {
    if (!autoRoll || !isOpen) return;
    const { formula, label } = autoRoll;
    const parsed = parseFormula(formula);
    if (parsed) performRoll(parsed.dice, parsed.modifier, label || formula);
  }, [autoRoll, isOpen, performRoll]);

  const addToTray = (type: DieType) => {
    setTray(prev => {
      const existing = prev.queue.find(q => q.type === type);
      if (existing) {
        return { ...prev, queue: prev.queue.map(q => q.type === type ? { ...q, count: q.count + 1 } : q) };
      }
      return { ...prev, queue: [...prev.queue, { type, count: 1 }] };
    });
  };

  const rollTray = () => {
    if (tray.queue.length === 0) return;
    performRoll(tray.queue, tray.modifier);
    setTray({ queue: [], modifier: 0 });
  };

  const quickRoll = (type: DieType) => performRoll([{ type, count: 1 }], 0, `d${type}`);

  if (!isOpen) return null;

  const anyRolling = dice.some(d => d.rolling);

  return (
    <>
      {/* ── Keyframe styles injected inline ── */}
      <style>{`
        @keyframes dice-arc {
          0%   { transform: translateY(0px) scale(0.7); opacity: 0.4; }
          30%  { transform: translateY(-60px) scale(1.15); opacity: 1; }
          60%  { transform: translateY(-30px) scale(1.05); }
          80%  { transform: translateY(-8px) scale(1.02); }
          90%  { transform: translateY(-3px) scale(1.01); }
          100% { transform: translateY(0px) scale(1); }
        }
        @keyframes die-spin {
          from { transform: rotate3d(1, 1, 0.5, 0deg); }
          to   { transform: rotate3d(1, 1, 0.5, 360deg); }
        }
        @keyframes die-land-bounce {
          0%   { transform: translateY(0) scaleY(1); }
          20%  { transform: translateY(-8px) scaleY(1.05); }
          40%  { transform: translateY(0) scaleY(0.95); }
          60%  { transform: translateY(-3px) scaleY(1.02); }
          80%  { transform: translateY(0) scaleY(0.98); }
          100% { transform: translateY(0) scaleY(1); }
        }
        @keyframes crit-flash {
          0%, 100% { box-shadow: 0 0 10px 2px #ffd700; }
          50%       { box-shadow: 0 0 30px 10px #ffd70088; }
        }
        @keyframes fumble-flash {
          0%, 100% { box-shadow: 0 0 10px 2px #cc0000; }
          50%       { box-shadow: 0 0 30px 10px #cc000088; }
        }
        .die-wrapper-rolling {
          animation: dice-arc 0.8s cubic-bezier(0.2, 0, 0.4, 1) forwards;
        }
        .die-wrapper-landed {
          animation: die-land-bounce 0.35s ease-out forwards;
        }
      `}</style>

      {/* ── Overlay ── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        }}
      />

      {/* ── Dice table ── */}
      <div style={{
        position: "fixed", bottom: 80, right: 24, zIndex: 51,
        width: 320, maxHeight: "70vh",
        background: "linear-gradient(160deg, #1a1108 0%, #0d0b06 100%)",
        border: "2px solid #c4a265",
        borderRadius: 14,
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(196,162,101,0.2)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid #4a2e0e44",
          background: "linear-gradient(180deg, #2a1e08 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>🎲</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#f4e9c9", fontFamily: "serif", letterSpacing: "0.08em" }}>DICE ROLLER</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a6830", padding: 4 }}>
            <X size={14} />
          </button>
        </div>

        {/* ── Dice stage — where dice are thrown ── */}
        <div style={{
          minHeight: 120,
          background: "radial-gradient(ellipse at center, #2a1a08 0%, #0d0b06 70%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexWrap: "wrap", gap: 8, padding: 16,
          position: "relative",
          borderBottom: "1px solid #4a2e0e44",
        }}>
          {dice.length === 0 && !showResult && (
            <p style={{ fontSize: 10, color: "#8a6830", fontFamily: "serif", fontStyle: "italic", textAlign: "center" }}>
              Click a die to roll, or build your pool below
            </p>
          )}

          {dice.map((die, i) => (
            <div
              key={die.id}
              className={die.rolling ? "die-wrapper-rolling" : "die-wrapper-landed"}
              style={{
                animationDelay: die.rolling ? `${die.landDelay}ms` : "0ms",
              }}
            >
              <Die3D die={die} size={52} />
            </div>
          ))}
        </div>

        {/* ── Result banner ── */}
        {showResult && currentRoll && (
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #4a2e0e44" }}>
            <ResultBanner roll={currentRoll} onClose={() => setShowResult(false)} />
          </div>
        )}

        {/* ── Quick-roll die buttons ── */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #4a2e0e22" }}>
          <div style={{ fontSize: 8.5, color: "#8a6830", fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>
            Quick Roll
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DIE_TYPES.map(type => {
              const cfg = DIE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => quickRoll(type)}
                  title={`Roll 1${cfg.label}`}
                  style={{
                    width: 38, height: 38,
                    borderRadius: 8,
                    background: `${cfg.color}22`,
                    border: `1.5px solid ${cfg.color}66`,
                    color: cfg.color,
                    fontSize: 10, fontWeight: 800, fontFamily: "serif",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${cfg.color}44`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${cfg.color}22`)}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Dice pool builder ── */}
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 8.5, color: "#8a6830", fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>
            Build Pool
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {DIE_TYPES.map(type => {
              const cfg = DIE_CONFIG[type];
              const inTray = tray.queue.find(q => q.type === type);
              return (
                <button
                  key={type}
                  onClick={() => addToTray(type)}
                  style={{
                    padding: "3px 7px",
                    borderRadius: 5,
                    background: inTray ? `${cfg.color}33` : "transparent",
                    border: `1px solid ${cfg.color}${inTray ? "aa" : "44"}`,
                    color: cfg.color,
                    fontSize: 9, fontWeight: 700, fontFamily: "serif",
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  {cfg.label}
                  {inTray && (
                    <span style={{
                      position: "absolute", top: -5, right: -5,
                      width: 14, height: 14, borderRadius: "50%",
                      background: cfg.color, color: "white",
                      fontSize: 8, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {inTray.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Modifier + roll */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#8a6830", fontFamily: "serif" }}>Modifier</span>
            <button onClick={() => setTray(t => ({ ...t, modifier: t.modifier - 1 }))}
              style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", border: "1px solid #4a2e0e66", color: "#8a6830", cursor: "pointer", fontSize: 12 }}>−</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f4e9c9", fontFamily: "serif", minWidth: 24, textAlign: "center" }}>
              {tray.modifier > 0 ? `+${tray.modifier}` : tray.modifier}
            </span>
            <button onClick={() => setTray(t => ({ ...t, modifier: t.modifier + 1 }))}
              style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", border: "1px solid #4a2e0e66", color: "#8a6830", cursor: "pointer", fontSize: 12 }}>+</button>

            <button
              onClick={rollTray}
              disabled={tray.queue.length === 0 || anyRolling}
              style={{
                marginLeft: "auto",
                padding: "5px 14px",
                borderRadius: 6,
                background: tray.queue.length > 0 ? "linear-gradient(135deg, #c4a265, #9a7835)" : "#2a1e0844",
                border: `1px solid ${tray.queue.length > 0 ? "#c4a265" : "#4a2e0e44"}`,
                color: tray.queue.length > 0 ? "#1a0f00" : "#4a2e0e",
                fontSize: 10, fontWeight: 900, fontFamily: "serif", letterSpacing: "0.08em",
                cursor: tray.queue.length > 0 ? "pointer" : "not-allowed",
                textTransform: "uppercase" as const,
              }}
            >
              {anyRolling ? "Rolling..." : tray.queue.length > 0
                ? `Roll ${tray.queue.map(q => `${q.count}${DIE_CONFIG[q.type].label}`).join("+")}${tray.modifier ? `${tray.modifier > 0 ? "+" : ""}${tray.modifier}` : ""}`
                : "Roll"}
            </button>

            {tray.queue.length > 0 && (
              <button onClick={() => setTray({ queue: [], modifier: 0 })}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#4a2e0e66", padding: 2 }}>
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Formula parser (for DM text auto-detection) ───────────────────────────
// Parses strings like "2d6+3", "1d20", "d8-1", "4d6 drop lowest"
export function parseFormula(formula: string): { dice: Array<{ type: DieType; count: number }>; modifier: number } | null {
  const clean = formula.toLowerCase().replace(/\s/g, "");
  const diceRegex = /(\d*)d(\d+)/g;
  const modRegex = /[+\-]\d+$/;

  const dice: Array<{ type: DieType; count: number }> = [];
  let match;

  while ((match = diceRegex.exec(clean)) !== null) {
    const count = parseInt(match[1] || "1");
    const faces = parseInt(match[2]);
    if (DIE_TYPES.includes(faces as DieType)) {
      dice.push({ type: faces as DieType, count: Math.min(count, 12) });
    }
  }

  if (dice.length === 0) return null;

  const modMatch = clean.match(modRegex);
  const modifier = modMatch ? parseInt(modMatch[0]) : 0;

  return { dice, modifier };
}

// ── Detect roll formulas in DM text ──────────────────────────────────────
export function detectDiceRolls(text: string): Array<{ formula: string; label: string; index: number }> {
  const results: Array<{ formula: string; label: string; index: number }> = [];
  // Match patterns like "d20+5 = 17", "2d6+3 = 11", "roll: d20"
  const pattern = /(\d*d(?:4|6|8|10|12|20|100)(?:[+\-]\d+)?)\s*(?:=\s*(\d+))?/gi;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    results.push({ formula: m[1], label: m[0].trim(), index: m.index });
  }
  return results;
}

// ── Dice trigger button for the chat interface ────────────────────────────
export function DiceButton({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      title="Open dice roller"
      data-testid="button-dice-roller"
      style={{
        width: 36, height: 36,
        borderRadius: 8,
        background: active
          ? "linear-gradient(135deg, #c4a26522, #9a783522)"
          : "transparent",
        border: `1.5px solid ${active ? "#c4a265" : "#4a2e0e66"}`,
        color: active ? "#c4a265" : "#8a6830",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      🎲
    </button>
  );
}
