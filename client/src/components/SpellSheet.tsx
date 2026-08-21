/**
 * SpellSheet — dedicated spell & resource tracking panel
 *
 * Covers:
 *   – Standard spell slots (levels 1–9) with bubble toggles
 *   – EPIC spell slots (levels 10+, no cap) — for god-tier / mythic / homebrew
 *   – Metamagic feats — each with individual uses (Twinned, Subtle, Quickened…)
 *   – Custom resource pools — Sorcery Points, Ki, Superiority Dice,
 *     Bardic Inspiration, Lay on Hands, Action Surge, Arcane Recovery, Pact Magic,
 *     or ANY homebrew resource with a name and bubble count
 *   – Cantrips (unlimited)
 *   – Spells/abilities by level with Cast button (upcast aware)
 *   – Long Rest / Short Rest restore buttons per resource
 *   – All state persisted to characterData blob via /api/characters/:id/spell-data
 */

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Character } from "@shared/schema";
import { Sparkles, Plus, Trash2, ChevronDown, ChevronUp, Zap, RefreshCw, Star } from "lucide-react";
import type { Ability } from "@/lib/characterSheetTypes";
import { spellSaveDcFor3e, resolveCastingAbilityScore } from "@/lib/spellMath";

// ── Parchment palette ──────────────────────────────────────────────────────
const C = {
  paper:     "hsl(var(--dm-parchment))",
  paperDark: "hsl(var(--dm-parchment) / 0.85)",
  ink:       "hsl(var(--dm-parchment-ink))",
  inkMid:    "hsl(var(--dm-parchment-ink) / 0.85)",
  inkLight:  "hsl(var(--dm-parchment-ink) / 0.65)",
  inkFaint:  "hsl(var(--dm-parchment-ink) / 0.45)",
  crimson:   "#7a1515",
  crimsonBg: "#7a151514",
  gold:      "#b8880a",
  goldBg:    "#b8880a14",
  purple:    "#5a1a80",
  purpleBg:  "#5a1a8014",
  epic:      "#0a4a6a",   // teal-navy for epic (beyond mortal)
  epicBg:    "#0a4a6a14",
  meta:      "#3a1a5a",   // deep indigo for metamagic
  metaBg:    "#3a1a5a14",
  green:     "#1a5c1a",
  greenBg:   "#1a5c1a14",
  border:    "hsl(var(--dm-parchment-line))",
  borderDark:"hsl(var(--dm-parchment-line) / 0.7)",
  shadow:    "hsl(var(--dm-void) / 0.15)",
};

// ── Level colours: 1–9 standard, 10–20 epic (increasingly cosmic) ─────────
const LEVEL_COLORS: Record<number, string> = {
  1:  "#b8880a", // gold
  2:  "#a05820", // copper
  3:  "#7a1515", // crimson
  4:  "#8b1a60", // magenta
  5:  "#5a1a80", // purple
  6:  "#1a3a7a", // navy
  7:  "#1a5c3a", // forest
  8:  "#3a3a1a", // dark olive
  9:  "#1a1a1a", // near black (legendary)
  10: "#0a3a5a", // epic teal
  11: "#0a2a6a", // deep sapphire
  12: "#2a0a6a", // indigo
  13: "#5a0a60", // void magenta
  14: "#6a0a2a", // blood
  15: "#3a0a0a", // abyss
  16: "#0a0a3a", // void navy
  17: "#0a3a0a", // void green
  18: "#2a2a00", // void gold
  19: "#3a1500", // void copper
  20: "#000000", // absolute zero
};
function levelColor(lvl: number): string {
  return LEVEL_COLORS[lvl] || (lvl > 9 ? C.epic : C.purple);
}

// ── Standard metamagic options (Sorcerer) ─────────────────────────────────
const METAMAGIC_OPTIONS = [
  "Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell",
  "Heightened Spell", "Quickened Spell", "Seeking Spell", "Subtle Spell",
  "Transmuted Spell", "Twinned Spell",
];

// ── Common custom resource templates ──────────────────────────────────────
const RESOURCE_TEMPLATES = [
  { name: "Sorcery Points",     max: 5,  restOn: "long",  icon: "✦" },
  { name: "Ki Points",          max: 5,  restOn: "short", icon: "◉" },
  { name: "Superiority Dice",   max: 4,  restOn: "short", icon: "⬡" },
  { name: "Bardic Inspiration", max: 4,  restOn: "long",  icon: "♪" },
  { name: "Lay on Hands",       max: 25, restOn: "long",  icon: "♥", isPool: true },
  { name: "Action Surge",       max: 1,  restOn: "short", icon: "⚡" },
  { name: "Second Wind",        max: 1,  restOn: "short", icon: "↑" },
  { name: "Arcane Recovery",    max: 1,  restOn: "long",  icon: "⟳" },
  { name: "Wild Shape",         max: 2,  restOn: "short", icon: "◈" },
  { name: "Channel Divinity",   max: 1,  restOn: "short", icon: "☼" },
  { name: "Sneak Attack",       max: 1,  restOn: "turn",  icon: "†" },
  { name: "Pact Magic Slots",   max: 2,  restOn: "short", icon: "◇" },
];

// ── Data shapes ─────────────────────────────────────────────────────────────
export interface SpellEntry {
  name: string;
  level: number;        // 0 = cantrip, 1–9 standard, 10+ epic
  prepared?: boolean;
  ritual?: boolean;
  concentration?: boolean;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  school?: string;
  description?: string;
  upcastNote?: string;  // e.g. "Each extra slot level adds 1d8"
}

export interface SpellSlotState {
  total: number;
  used: number;
}

export interface MetamagicEntry {
  name: string;
  costPerUse: number;   // Sorcery Points consumed (usually 1–3)
  description?: string;
}

export interface CustomResource {
  id: string;           // unique key
  name: string;
  icon: string;         // emoji or single char
  current: number;
  max: number;
  isPool: boolean;      // true = numeric pool (Lay on Hands HP), false = bubble count
  restOn: "long" | "short" | "turn" | "never";
  description?: string;
}

export interface SpellData {
  castingClass: string;
  castingAbility: string;
  spellSaveDC: number | null;
  spellAttackBonus: number | null;
  // Standard slots 1–9
  slots: Record<number, SpellSlotState>;
  // Epic slots 10+ (no cap — add as needed)
  epicSlots: Record<number, SpellSlotState>;
  // Metamagic feats
  sorceryPoints: SpellSlotState;   // the pool that fuels metamagic
  metamagic: MetamagicEntry[];     // which metamagic options are known
  // Generic custom resources
  customResources: CustomResource[];
  // All spells/abilities (cantrips, standard, epic)
  spells: SpellEntry[];
}

function emptySpellData(): SpellData {
  return {
    castingClass: "",
    castingAbility: "INT",
    spellSaveDC: null,
    spellAttackBonus: null,
    slots: {},
    epicSlots: {},
    sorceryPoints: { total: 0, used: 0 },
    metamagic: [],
    customResources: [],
    spells: [],
  };
}

// ── Parse characterData blob ───────────────────────────────────────────────
export function getSpellData(characterData: string): SpellData {
  try {
    const cd = JSON.parse(characterData || "{}");
    if (cd.spellData) {
      const d = emptySpellData();
      return { ...d, ...cd.spellData,
        epicSlots: cd.spellData.epicSlots || {},
        sorceryPoints: cd.spellData.sorceryPoints || { total: 0, used: 0 },
        metamagic: cd.spellData.metamagic || [],
        customResources: cd.spellData.customResources || [],
      };
    }

    // Auto-seed from sections
    const sections: Array<{ label: string; entries: Array<{ key: string; value: string }> }> = cd.sections || [];
    const seed = emptySpellData();
    const spellSec = sections.find(s => s.label.toLowerCase().includes("spell") && !s.label.toLowerCase().includes("slot"));
    const slotSec  = sections.find(s => s.label.toLowerCase().includes("slot"));

    if (spellSec) {
      for (const e of spellSec.entries) {
        const lvl = levelFromEntry(e.value);
        seed.spells.push({ name: e.key, level: lvl, prepared: true });
      }
    }
    if (slotSec) {
      for (const e of slotSec.entries) {
        const m = e.key.match(/(\d+)/);
        const lvl = m ? parseInt(m[1]) : null;
        if (lvl && lvl >= 1) {
          const total = parseInt(e.value) || 0;
          if (lvl <= 9) seed.slots[lvl] = { total, used: 0 };
          else          seed.epicSlots[lvl] = { total, used: 0 };
        }
      }
    }
    return seed;
  } catch { return emptySpellData(); }
}

function levelFromEntry(value: string): number {
  const v = value.toLowerCase();
  if (v.includes("cantrip") || v === "0") return 0;
  const m = v.match(/level\s*(\d+)/i) || v.match(/^(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

export function setSpellData(characterData: string, spellData: SpellData): string {
  try {
    const cd = JSON.parse(characterData || "{}");
    cd.spellData = spellData;
    return JSON.stringify(cd);
  } catch { return JSON.stringify({ spellData }); }
}

// ── Bubble row (reusable) ──────────────────────────────────────────────────
function Bubbles({ total, used, color, onToggle, maxDisplay = 20 }: {
  total: number; used: number; color: string;
  onToggle: (used: number) => void;
  maxDisplay?: number;
}) {
  const display = Math.min(total, maxDisplay);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap" }}>
      {Array.from({ length: display }, (_, i) => (
        <button key={i}
          onClick={() => onToggle(i < used ? i : i + 1)}
          title={i < used ? "Restore" : "Expend"}
          style={{
            width: 12, height: 12, borderRadius: "50%",
            border: `1.5px solid ${color}`,
            background: i < used ? color : "transparent",
            cursor: "pointer", flexShrink: 0,
            transition: "background 0.12s",
          }} />
      ))}
      {total > maxDisplay && (
        <span style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif" }}>+{total - maxDisplay}</span>
      )}
      {total === 0 && <span style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif" }}>—</span>}
    </div>
  );
}

// ── Slot row (standard + epic) ─────────────────────────────────────────────
function SlotRow({ lvl, slot, isEpic, onToggle, onSetTotal, isMyChar }: {
  lvl: number; slot: SpellSlotState; isEpic: boolean;
  onToggle: (used: number) => void;
  onSetTotal: (total: number) => void;
  isMyChar: boolean;
}) {
  const color = levelColor(lvl);
  const remaining = slot.total - slot.used;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
      {/* Level badge */}
      <div style={{
        minWidth: isEpic ? 24 : 14, height: 14, borderRadius: 3,
        background: isEpic ? C.epicBg : "transparent",
        border: isEpic ? `1px solid ${C.epic}66` : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: isEpic ? 7.5 : 8, fontWeight: 900, fontFamily: "serif", color, letterSpacing: isEpic ? "0.04em" : 0 }}>
          {isEpic ? `L${lvl}` : lvl}
        </span>
      </div>

      {/* Bubbles */}
      <div style={{ flex: 1 }}>
        <Bubbles total={slot.total} used={slot.used} color={color} onToggle={onToggle} />
      </div>

      {/* Remaining count */}
      <span style={{ fontSize: 7.5, color: remaining > 0 ? color : C.inkFaint, fontFamily: "serif", width: 24, textAlign: "right", flexShrink: 0 }}>
        {remaining}/{slot.total}
      </span>

      {/* +/− controls */}
      {isMyChar && (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={() => onSetTotal(Math.max(0, slot.total - 1))}
            style={{ width: 12, height: 12, fontSize: 8, border: `1px solid ${C.border}`, borderRadius: 2, background: "transparent", color: C.inkFaint, cursor: "pointer", lineHeight: 1 }}>−</button>
          <button onClick={() => onSetTotal(slot.total + 1)}
            style={{ width: 12, height: 12, fontSize: 8, border: `1px solid ${C.border}`, borderRadius: 2, background: "transparent", color: C.inkFaint, cursor: "pointer", lineHeight: 1 }}>+</button>
        </div>
      )}
    </div>
  );
}

// ── CollapsibleSection ─────────────────────────────────────────────────────
function Sub({ label, color = C.inkLight, defaultOpen = true, children }: {
  label: string; color?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "0 0 3px 0", borderBottom: `1px solid ${C.border}44`, marginBottom: open ? 6 : 0 }}>
        <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: "0.12em", color, textTransform: "uppercase", fontFamily: "serif" }}>{label}</span>
        {open ? <ChevronUp size={8} color={C.inkFaint} /> : <ChevronDown size={8} color={C.inkFaint} />}
      </button>
      {open && children}
    </div>
  );
}

// ── Spell row ─────────────────────────────────────────────────────────────
function SpellRow({ spell, hasSlot, onCast, onDelete, isMyChar }: {
  spell: SpellEntry; hasSlot: boolean;
  onCast: () => void; onDelete: () => void; isMyChar: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = levelColor(spell.level);
  const isEpic = spell.level >= 10;

  return (
    <div style={{ borderBottom: `1px solid ${C.border}22`, paddingBottom: 4, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          border: `1.5px solid ${color}`,
          background: spell.prepared !== false ? color : "transparent",
        }} />
        <button onClick={() => setExpanded(e => !e)}
          style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: "serif", color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {spell.name}
            </span>
            {isEpic && <span style={{ fontSize: 7, fontWeight: 700, padding: "0 3px", background: C.epicBg, border: `1px solid ${C.epic}66`, borderRadius: 2, color: C.epic, fontFamily: "serif" }}>EPIC</span>}
            {spell.ritual && <span style={{ fontSize: 7, color: C.gold, fontFamily: "serif" }}>R</span>}
            {spell.concentration && <span style={{ fontSize: 7, color: C.crimson, fontFamily: "serif" }}>C</span>}
            {spell.school && <span style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic" }}>{spell.school}</span>}
          </div>
        </button>
        {isMyChar && spell.level > 0 && (
          <button onClick={onCast} disabled={!hasSlot}
            style={{ padding: "1px 5px", fontSize: 7.5, fontWeight: 700, fontFamily: "serif",
              color: hasSlot ? color : C.inkFaint,
              background: hasSlot ? `${color}18` : "transparent",
              border: `1px solid ${hasSlot ? color + "66" : C.border + "33"}`,
              borderRadius: 3, cursor: hasSlot ? "pointer" : "not-allowed", flexShrink: 0 }}>
            Cast
          </button>
        )}
        {isMyChar && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            <Trash2 size={8} color={C.inkFaint} />
          </button>
        )}
      </div>
      {expanded && (spell.castingTime || spell.range || spell.duration || spell.description || spell.upcastNote) && (
        <div style={{ paddingTop: 4, paddingLeft: 12 }}>
          {[
            spell.castingTime && `Cast: ${spell.castingTime}`,
            spell.range && `Range: ${spell.range}`,
            spell.components && `Components: ${spell.components}`,
            spell.duration && `Duration: ${spell.duration}`,
          ].filter(Boolean).map((line, i) => (
            <div key={i} style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif", marginBottom: 1 }}>{line}</div>
          ))}
          {spell.description && (
            <p style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif", fontStyle: "italic", margin: "3px 0 0 0", lineHeight: 1.4 }}>{spell.description}</p>
          )}
          {spell.upcastNote && (
            <p style={{ fontSize: 7.5, color: C.epic, fontFamily: "serif", margin: "3px 0 0 0", fontStyle: "italic" }}>
              ↑ Upcast: {spell.upcastNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Custom resource row ────────────────────────────────────────────────────
function ResourceRow({ resource, onUpdate, onDelete, isMyChar }: {
  resource: CustomResource;
  onUpdate: (r: CustomResource) => void;
  onDelete: () => void;
  isMyChar: boolean;
}) {
  const color = C.gold;

  return (
    <div style={{ borderBottom: `1px solid ${C.border}22`, paddingBottom: 5, marginBottom: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
        <span style={{ fontSize: 10, lineHeight: 1, flexShrink: 0 }}>{resource.icon}</span>
        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "serif", color: C.ink, flex: 1 }}>{resource.name}</span>
        <span style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", flexShrink: 0 }}>
          {resource.restOn === "long" ? "Long Rest" : resource.restOn === "short" ? "Short Rest" : resource.restOn === "turn" ? "Per Turn" : "Manual"}
        </span>
        {isMyChar && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Trash2 size={7} color={C.inkFaint} />
          </button>
        )}
      </div>

      {resource.isPool ? (
        // Numeric pool (e.g. Lay on Hands HP)
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {[-5,-1].map(d => (
              <button key={d} onClick={() => onUpdate({ ...resource, current: Math.max(0, resource.current + d) })}
                style={{ padding: "1px 4px", fontSize: 8, fontFamily: "serif", color: C.crimson, background: C.crimsonBg, border: `1px solid ${C.crimson}55`, borderRadius: 3, cursor: "pointer" }}>
                {d}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "serif", color: C.gold }}>{resource.current}</span>
          <span style={{ fontSize: 8, color: C.inkFaint, fontFamily: "serif" }}>/ {resource.max}</span>
          <div style={{ display: "flex", gap: 3 }}>
            {[1,5].map(d => (
              <button key={d} onClick={() => onUpdate({ ...resource, current: Math.min(resource.max, resource.current + d) })}
                style={{ padding: "1px 4px", fontSize: 8, fontFamily: "serif", color: C.green, background: C.greenBg, border: `1px solid ${C.green}55`, borderRadius: 3, cursor: "pointer" }}>
                +{d}
              </button>
            ))}
          </div>
          {isMyChar && (
            <button onClick={() => onUpdate({ ...resource, current: resource.max })}
              style={{ marginLeft: "auto", padding: "1px 4px", fontSize: 7, fontFamily: "serif", color: C.green, border: `1px solid ${C.green}55`, borderRadius: 3, background: "transparent", cursor: "pointer" }}>
              Restore
            </button>
          )}
        </div>
      ) : (
        // Bubble count
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Bubbles total={resource.max} used={resource.max - resource.current} color={color}
            onToggle={(usedCount) => onUpdate({ ...resource, current: resource.max - usedCount })} />
          <span style={{ fontSize: 8, color: C.inkFaint, fontFamily: "serif", marginLeft: "auto" }}>
            {resource.current}/{resource.max}
          </span>
          {isMyChar && resource.max > 6 && (
            <div style={{ display: "flex", gap: 2 }}>
              <button onClick={() => onUpdate({ ...resource, current: Math.max(0, resource.current - 1) })}
                style={{ padding: "1px 4px", fontSize: 7.5, fontFamily: "serif", color: C.crimson, background: C.crimsonBg, border: `1px solid ${C.crimson}55`, borderRadius: 3, cursor: "pointer" }}>Use</button>
              <button onClick={() => onUpdate({ ...resource, current: resource.max })}
                style={{ padding: "1px 4px", fontSize: 7.5, fontFamily: "serif", color: C.green, background: C.greenBg, border: `1px solid ${C.green}55`, borderRadius: 3, cursor: "pointer" }}>Full</button>
            </div>
          )}
        </div>
      )}

      {resource.description && (
        <p style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", margin: "3px 0 0 8px", lineHeight: 1.3 }}>
          {resource.description}
        </p>
      )}
    </div>
  );
}

// ── Add Spell Form ─────────────────────────────────────────────────────────
function AddSpellForm({ onAdd, onClose, allowEpic }: {
  onAdd: (s: SpellEntry) => void; onClose: () => void; allowEpic?: boolean;
}) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [school, setSchool] = useState("");
  const [castingTime, setCastingTime] = useState("1 action");
  const [range, setRange] = useState("");
  const [components, setComponents] = useState("");
  const [duration, setDuration] = useState("");
  const [ritual, setRitual] = useState(false);
  const [concentration, setConcentration] = useState(false);
  const [description, setDescription] = useState("");
  const [upcastNote, setUpcastNote] = useState("");

  const iStyle: React.CSSProperties = {
    width: "100%", fontSize: 9, fontFamily: "serif", padding: "3px 5px",
    border: `1px solid ${C.border}`, borderRadius: 3,
    background: C.paperDark, color: C.ink, outline: "none",
    boxSizing: "border-box", marginBottom: 4,
  };

  const maxLevel = allowEpic ? 20 : 9;

  return (
    <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 5, padding: 8, marginTop: 6 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: C.purple, fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Add Spell / Ability</div>

      <input placeholder="Name *" value={name} onChange={e => setName(e.target.value)} style={iStyle} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Level</div>
          <select value={level} onChange={e => setLevel(Number(e.target.value))} style={{ ...iStyle, marginBottom: 0 }}>
            <option value={0}>Cantrip (∞)</option>
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map(l => (
              <option key={l} value={l}>{l <= 9 ? `Level ${l}` : `★ Epic ${l}`}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>School</div>
          <input placeholder="Evocation…" value={school} onChange={e => setSchool(e.target.value)} style={{ ...iStyle, marginBottom: 0 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Casting Time</div>
          <input placeholder="1 action" value={castingTime} onChange={e => setCastingTime(e.target.value)} style={{ ...iStyle, marginBottom: 0 }} />
        </div>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Range</div>
          <input placeholder="60 ft" value={range} onChange={e => setRange(e.target.value)} style={{ ...iStyle, marginBottom: 0 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Components</div>
          <input placeholder="V, S, M…" value={components} onChange={e => setComponents(e.target.value)} style={{ ...iStyle, marginBottom: 0 }} />
        </div>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Duration</div>
          <input placeholder="Instantaneous" value={duration} onChange={e => setDuration(e.target.value)} style={{ ...iStyle, marginBottom: 0 }} />
        </div>
      </div>

      <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...iStyle, resize: "none" as const }} />

      <input placeholder="Upcast note (e.g. +1d8 per slot level above 1st)" value={upcastNote} onChange={e => setUpcastNote(e.target.value)} style={iStyle} />

      <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
          <input type="checkbox" checked={ritual} onChange={e => setRitual(e.target.checked)} style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>Ritual</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
          <input type="checkbox" checked={concentration} onChange={e => setConcentration(e.target.checked)} style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>Concentration</span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 5 }}>
        <button onClick={onClose} style={{ flex: 1, fontSize: 8, fontFamily: "serif", padding: "4px", border: `1px solid ${C.border}`, borderRadius: 3, background: "transparent", color: C.inkMid, cursor: "pointer" }}>Cancel</button>
        <button onClick={() => { if (name.trim()) { onAdd({ name: name.trim(), level, school, castingTime, range, components, duration, ritual, concentration, description, upcastNote: upcastNote || undefined, prepared: true }); onClose(); }}}
          disabled={!name.trim()}
          style={{ flex: 2, fontSize: 8, fontWeight: 700, fontFamily: "serif", padding: "4px", border: `1px solid ${C.purple}`, borderRadius: 3, background: C.purpleBg, color: C.purple, cursor: "pointer" }}>
          Add Spell
        </button>
      </div>
    </div>
  );
}

// ── Add Custom Resource Form ───────────────────────────────────────────────
function AddResourceForm({ onAdd, onClose }: { onAdd: (r: CustomResource) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("◈");
  const [max, setMax] = useState(3);
  const [isPool, setIsPool] = useState(false);
  const [restOn, setRestOn] = useState<"long"|"short"|"turn"|"never">("long");
  const [description, setDescription] = useState("");
  const [fromTemplate, setFromTemplate] = useState("");

  const applyTemplate = (tname: string) => {
    const t = RESOURCE_TEMPLATES.find(r => r.name === tname);
    if (t) { setName(t.name); setIcon(t.icon); setMax(t.max); setRestOn(t.restOn as any); setIsPool(!!t.isPool); }
    setFromTemplate(tname);
  };

  const iStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "serif", padding: "3px 5px",
    border: `1px solid ${C.border}`, borderRadius: 3,
    background: C.paperDark, color: C.ink, outline: "none",
  };

  return (
    <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 5, padding: 8, marginTop: 6 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: C.gold, fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Add Resource</div>

      {/* Template picker */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Quick template</div>
        <select value={fromTemplate} onChange={e => applyTemplate(e.target.value)}
          style={{ ...iStyle, width: "100%" }}>
          <option value="">— Custom —</option>
          {RESOURCE_TEMPLATES.map(t => <option key={t.name} value={t.name}>{t.icon} {t.name}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 5, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Icon</div>
          <input value={icon} onChange={e => setIcon(e.target.value.slice(0,2))} style={{ ...iStyle, width: "100%", textAlign: "center", fontSize: 12 }} />
        </div>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Name</div>
          <input placeholder="Resource name" value={name} onChange={e => setName(e.target.value)} style={{ ...iStyle, width: "100%", boxSizing: "border-box" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Maximum</div>
          <input type="number" min={1} max={999} value={max} onChange={e => setMax(Math.max(1, Number(e.target.value)))} style={{ ...iStyle, width: "100%", boxSizing: "border-box" }} />
        </div>
        <div>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Restore on</div>
          <select value={restOn} onChange={e => setRestOn(e.target.value as any)} style={{ ...iStyle, width: "100%", boxSizing: "border-box" }}>
            <option value="long">Long Rest</option>
            <option value="short">Short Rest</option>
            <option value="turn">Each Turn</option>
            <option value="never">Manual</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", marginBottom: 2 }}>Type</div>
          <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", marginTop: 4 }}>
            <input type="checkbox" checked={isPool} onChange={e => setIsPool(e.target.checked)} style={{ width: 10, height: 10 }} />
            <span style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>Numeric pool</span>
          </label>
        </div>
      </div>

      <input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)}
        style={{ ...iStyle, width: "100%", boxSizing: "border-box", marginBottom: 6 }} />

      <div style={{ display: "flex", gap: 5 }}>
        <button onClick={onClose} style={{ flex: 1, fontSize: 8, fontFamily: "serif", padding: "4px", border: `1px solid ${C.border}`, borderRadius: 3, background: "transparent", color: C.inkMid, cursor: "pointer" }}>Cancel</button>
        <button onClick={() => {
          if (name.trim()) {
            onAdd({ id: Date.now().toString(), name: name.trim(), icon, current: max, max, isPool, restOn, description: description || undefined });
            onClose();
          }
        }} disabled={!name.trim()}
          style={{ flex: 2, fontSize: 8, fontWeight: 700, fontFamily: "serif", padding: "4px", border: `1px solid ${C.gold}`, borderRadius: 3, background: C.goldBg, color: C.gold, cursor: "pointer" }}>
          Add Resource
        </button>
      </div>
    </div>
  );
}

// ── Add Metamagic Form ─────────────────────────────────────────────────────
function AddMetamagicForm({ onAdd, onClose }: { onAdd: (m: MetamagicEntry) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState(1);
  const [desc, setDesc] = useState("");
  const [preset, setPreset] = useState("");

  const iStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "serif", padding: "3px 5px",
    border: `1px solid ${C.border}`, borderRadius: 3,
    background: C.paperDark, color: C.ink, outline: "none",
    width: "100%", boxSizing: "border-box" as const, marginBottom: 4,
  };

  const METAMAGIC_COSTS: Record<string, number> = {
    "Careful Spell": 1, "Distant Spell": 1, "Extended Spell": 1, "Subtle Spell": 1,
    "Transmuted Spell": 1, "Seeking Spell": 2, "Empowered Spell": 1,
    "Heightened Spell": 3, "Quickened Spell": 2, "Twinned Spell": 1,
  };

  return (
    <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 5, padding: 8, marginTop: 6 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: C.meta, fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Add Metamagic</div>
      <select value={preset} onChange={e => {
        setPreset(e.target.value);
        if (e.target.value) { setName(e.target.value); setCost(METAMAGIC_COSTS[e.target.value] ?? 1); }
      }} style={iStyle}>
        <option value="">— Choose or type custom —</option>
        {METAMAGIC_OPTIONS.map(m => <option key={m} value={m}>{m} ({METAMAGIC_COSTS[m] ?? 1} SP)</option>)}
      </select>
      <input placeholder="Or custom name" value={name} onChange={e => setName(e.target.value)} style={iStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 8, color: C.inkFaint, fontFamily: "serif" }}>Sorcery Point cost:</span>
        <input type="number" min={1} max={10} value={cost} onChange={e => setCost(Math.max(1, Number(e.target.value)))}
          style={{ ...iStyle, width: 40, marginBottom: 0 }} />
      </div>
      <input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} style={iStyle} />
      <div style={{ display: "flex", gap: 5 }}>
        <button onClick={onClose} style={{ flex: 1, fontSize: 8, fontFamily: "serif", padding: "4px", border: `1px solid ${C.border}`, borderRadius: 3, background: "transparent", color: C.inkMid, cursor: "pointer" }}>Cancel</button>
        <button onClick={() => { if (name.trim()) { onAdd({ name: name.trim(), costPerUse: cost, description: desc || undefined }); onClose(); }}}
          disabled={!name.trim()}
          style={{ flex: 2, fontSize: 8, fontWeight: 700, fontFamily: "serif", padding: "4px", border: `1px solid ${C.meta}`, borderRadius: 3, background: C.metaBg, color: C.meta, cursor: "pointer" }}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Main SpellSheet ────────────────────────────────────────────────────────
interface Props {
  character: Character;
  isMyChar: boolean;
  abilities: Record<Ability, { score: number; modifier: number }>;
  ruleset: string;
}

export default function SpellSheet({ character, isMyChar, abilities, ruleset }: Props) {
  const [open, setOpen] = useState(false);
  const [showAddSpell, setShowAddSpell] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [showAddMeta, setShowAddMeta] = useState(false);
  const [showAddEpicSlot, setShowAddEpicSlot] = useState(false);

  const cd = (character as any).characterData || "{}";
  const spellData = getSpellData(cd);

  const hasContent = spellData.spells.length > 0
    || Object.keys(spellData.slots).length > 0
    || Object.keys(spellData.epicSlots).length > 0
    || spellData.customResources.length > 0
    || spellData.metamagic.length > 0;

  const saveMutation = useMutation({
    mutationFn: async (updated: SpellData) => {
      const res = await apiRequest("PATCH", `/api/characters/${character.id}/spell-data`, {
        characterData: setSpellData(cd, updated),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", character.campaignId, "characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", character.campaignId, "my-character"] });
    },
  });

  const save = useCallback((updated: SpellData) => saveMutation.mutate(updated), [saveMutation]);

  // Derived — ability score/modifier now come from the same authoritative
  // sheet.abilities every other part of the Character Sheet uses (design
  // spec 2026-08-20), not fuzzy-matched out of characterData text.
  const resolvedAbility = resolveCastingAbilityScore(abilities, spellData.castingAbility);
  const abilityMod = resolvedAbility?.modifier ?? 0;
  const is3e = ruleset === "dnd35e";
  const profBonus = character.level >= 17 ? 6 : character.level >= 13 ? 5 : character.level >= 9 ? 4 : character.level >= 5 ? 3 : 2;
  // 3.5e has no single flat DC (every spell level has its own — computed
  // per-row below via spellSaveDcFor3e). This flat value only ever
  // displays for non-3.5e rulesets, where it keeps using 5e's existing
  // formula unchanged.
  const spellSaveDC = spellData.spellSaveDC ?? (8 + profBonus + abilityMod);
  const spellAttackBonus = spellData.spellAttackBonus ?? (profBonus + abilityMod);

  const cantrips = spellData.spells.filter(s => s.level === 0);
  const standardSpells = spellData.spells.filter(s => s.level >= 1 && s.level <= 9);
  const epicSpells = spellData.spells.filter(s => s.level >= 10);

  const spellsByLevel = (spells: SpellEntry[]) => {
    const out: Record<number, SpellEntry[]> = {};
    spells.forEach(s => { if (!out[s.level]) out[s.level] = []; out[s.level].push(s); });
    return out;
  };

  const handleSlot = (lvl: number, used: number, isEpic: boolean) => {
    const target = isEpic ? spellData.epicSlots : spellData.slots;
    const cur = target[lvl] || { total: 0, used: 0 };
    const updated = { ...spellData };
    if (isEpic) updated.epicSlots = { ...updated.epicSlots, [lvl]: { ...cur, used: Math.max(0, Math.min(cur.total, used)) } };
    else        updated.slots    = { ...updated.slots,    [lvl]: { ...cur, used: Math.max(0, Math.min(cur.total, used)) } };
    save(updated);
  };

  const handleSetTotal = (lvl: number, total: number, isEpic: boolean) => {
    const target = isEpic ? spellData.epicSlots : spellData.slots;
    const cur = target[lvl] || { total: 0, used: 0 };
    const updated = { ...spellData };
    const newSlot = { total: Math.max(0, total), used: Math.min(cur.used, total) };
    if (isEpic) updated.epicSlots = { ...updated.epicSlots, [lvl]: newSlot };
    else        updated.slots    = { ...updated.slots,    [lvl]: newSlot };
    save(updated);
  };

  const handleCast = (spell: SpellEntry) => {
    const pool = spell.level >= 10 ? spellData.epicSlots : spellData.slots;
    for (let lvl = spell.level; lvl <= (spell.level >= 10 ? 20 : 9); lvl++) {
      const slot = pool[lvl];
      if (slot && slot.used < slot.total) {
        handleSlot(lvl, slot.used + 1, spell.level >= 10);
        return;
      }
    }
  };

  const handleLongRest = () => {
    const restSlots: Record<number, SpellSlotState> = {};
    for (const [k, v] of Object.entries(spellData.slots)) restSlots[Number(k)] = { ...v, used: 0 };
    const restEpic: Record<number, SpellSlotState> = {};
    for (const [k, v] of Object.entries(spellData.epicSlots)) restEpic[Number(k)] = { ...v, used: 0 };
    const restResources = spellData.customResources.map(r => r.restOn === "long" ? { ...r, current: r.max } : r);
    save({ ...spellData, slots: restSlots, epicSlots: restEpic,
      sorceryPoints: { ...spellData.sorceryPoints, used: 0 },
      customResources: restResources });
  };

  const handleShortRest = () => {
    const restResources = spellData.customResources.map(r => r.restOn === "short" ? { ...r, current: r.max } : r);
    // Pact Magic restores on short rest
    const restSlots: Record<number, SpellSlotState> = { ...spellData.slots };
    save({ ...spellData, slots: restSlots, customResources: restResources });
  };

  const addEpicSlot = (lvl: number) => {
    if (lvl < 10 || lvl > 30) return;
    const existing = spellData.epicSlots[lvl] || { total: 0, used: 0 };
    save({ ...spellData, epicSlots: { ...spellData.epicSlots, [lvl]: { ...existing, total: existing.total + 1 } } });
  };

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Section toggle */}
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "0 0 4px 0", borderBottom: `1.5px solid ${C.borderDark}`, marginBottom: open ? 8 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Sparkles size={10} color={C.purple} />
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.15em", color: C.purple, textTransform: "uppercase", fontFamily: "serif" }}>Spellcasting</span>
          {hasContent && <span style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif" }}>({spellData.spells.length} spells)</span>}
          {Object.keys(spellData.epicSlots).length > 0 && (
            <span style={{ fontSize: 7, fontWeight: 700, padding: "0 3px", background: C.epicBg, border: `1px solid ${C.epic}55`, borderRadius: 2, color: C.epic, fontFamily: "serif" }}>EPIC</span>
          )}
        </div>
        {open ? <ChevronUp size={9} color={C.inkFaint} /> : <ChevronDown size={9} color={C.inkFaint} />}
      </button>

      {open && (
        <div>
          {/* ── Casting stats ── */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Ability</div>
              <select value={spellData.castingAbility} onChange={e => save({ ...spellData, castingAbility: e.target.value })}
                style={{ width: "100%", fontSize: 9, fontFamily: "serif", padding: "2px 3px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.paperDark, color: C.ink, outline: "none" }}>
                {["STR","DEX","CON","INT","WIS","CHA","Custom"].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            {is3e ? (
              <div style={{ flex: 2, textAlign: "center" }}>
                <div style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
                  Save DC (10 + spell level {abilityMod >= 0 ? `+ ${abilityMod}` : `- ${Math.abs(abilityMod)}`})
                </div>
                <div style={{ border: `1.5px solid ${C.purple}66`, borderRadius: 4, padding: "3px 0", background: C.purpleBg }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.purple, fontFamily: "serif" }}>
                    See each spell level below — 3.5e has no single flat DC.
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Save DC</div>
                  <div style={{ border: `1.5px solid ${C.purple}66`, borderRadius: 4, padding: "3px 0", background: C.purpleBg }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: C.purple, fontFamily: "serif" }}>{spellSaveDC}</span>
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Atk Bonus</div>
                  <div style={{ border: `1.5px solid ${C.purple}66`, borderRadius: 4, padding: "3px 0", background: C.purpleBg }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: C.purple, fontFamily: "serif" }}>{spellAttackBonus >= 0 ? `+${spellAttackBonus}` : spellAttackBonus}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Rest buttons ── */}
          {isMyChar && (
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              <button onClick={handleShortRest}
                style={{ flex: 1, fontSize: 7.5, fontFamily: "serif", padding: "3px", color: C.gold, border: `1px solid ${C.gold}55`, borderRadius: 3, background: C.goldBg, cursor: "pointer" }}>
                Short Rest
              </button>
              <button onClick={handleLongRest}
                style={{ flex: 1, fontSize: 7.5, fontFamily: "serif", padding: "3px", color: C.green, border: `1px solid ${C.green}55`, borderRadius: 3, background: C.greenBg, cursor: "pointer" }}>
                Long Rest (restore all)
              </button>
            </div>
          )}

          {/* ── Standard Spell Slots 1–9 ── */}
          <Sub label="Spell Slots (1–9)" color={C.purple}>
            {[1,2,3,4,5,6,7,8,9].map(lvl => {
              const slot = spellData.slots[lvl];
              if (!slot && !standardSpells.some(s => s.level === lvl)) return null;
              return (
                <SlotRow key={lvl} lvl={lvl} isEpic={false}
                  slot={slot || { total: 0, used: 0 }}
                  onToggle={used => handleSlot(lvl, used, false)}
                  onSetTotal={total => handleSetTotal(lvl, total, false)}
                  isMyChar={isMyChar}
                />
              );
            })}
          </Sub>

          {/* ── Epic Spell Slots 10+ ── */}
          <Sub label={`Epic Slots (10+)`} color={C.epic} defaultOpen={Object.keys(spellData.epicSlots).length > 0}>
            {Object.entries(spellData.epicSlots).sort(([a],[b]) => Number(a)-Number(b)).map(([lvl, slot]) => (
              <SlotRow key={lvl} lvl={Number(lvl)} isEpic={true}
                slot={slot}
                onToggle={used => handleSlot(Number(lvl), used, true)}
                onSetTotal={total => handleSetTotal(Number(lvl), total, true)}
                isMyChar={isMyChar}
              />
            ))}
            {Object.keys(spellData.epicSlots).length === 0 && (
              <p style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", margin: "4px 0" }}>
                No epic slots yet — add levels 10+ below
              </p>
            )}
            {isMyChar && (
              <div style={{ marginTop: 4 }}>
                {showAddEpicSlot ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 8, color: C.inkFaint, fontFamily: "serif" }}>Add level:</span>
                    {[10,11,12,13,14,15,16,17,18,19,20].filter(l => !spellData.epicSlots[l]).slice(0,6).map(l => (
                      <button key={l} onClick={() => { addEpicSlot(l); setShowAddEpicSlot(false); }}
                        style={{ padding: "1px 5px", fontSize: 8, fontWeight: 700, fontFamily: "serif", color: C.epic, border: `1px solid ${C.epic}55`, borderRadius: 3, background: C.epicBg, cursor: "pointer" }}>
                        {l}
                      </button>
                    ))}
                    <button onClick={() => setShowAddEpicSlot(false)}
                      style={{ fontSize: 8, color: C.inkFaint, border: "none", background: "none", cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddEpicSlot(true)}
                    style={{ width: "100%", padding: "3px", fontSize: 7.5, fontFamily: "serif", fontWeight: 700, color: C.epic, border: `1px dashed ${C.epic}55`, borderRadius: 3, background: "transparent", cursor: "pointer" }}>
                    + Add Epic Slot Level
                  </button>
                )}
              </div>
            )}
          </Sub>

          {/* ── Metamagic ── */}
          <Sub label="Metamagic" color={C.meta} defaultOpen={spellData.metamagic.length > 0 || spellData.sorceryPoints.total > 0}>
            {/* Sorcery Points pool */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "serif", color: C.meta }}>✦ Sorcery Points</span>
                <span style={{ fontSize: 8, color: C.inkFaint, fontFamily: "serif" }}>
                  {spellData.sorceryPoints.total - spellData.sorceryPoints.used}/{spellData.sorceryPoints.total}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <Bubbles total={spellData.sorceryPoints.total} used={spellData.sorceryPoints.used} color={C.meta}
                  onToggle={used => save({ ...spellData, sorceryPoints: { ...spellData.sorceryPoints, used } })} />
              </div>
              {isMyChar && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif" }}>Max:</span>
                  <button onClick={() => save({ ...spellData, sorceryPoints: { ...spellData.sorceryPoints, total: Math.max(0, spellData.sorceryPoints.total - 1) } })}
                    style={{ width: 12, height: 12, fontSize: 8, border: `1px solid ${C.border}`, borderRadius: 2, background: "transparent", color: C.inkFaint, cursor: "pointer" }}>−</button>
                  <span style={{ fontSize: 8, fontFamily: "serif", color: C.inkMid }}>{spellData.sorceryPoints.total}</span>
                  <button onClick={() => save({ ...spellData, sorceryPoints: { ...spellData.sorceryPoints, total: spellData.sorceryPoints.total + 1 } })}
                    style={{ width: 12, height: 12, fontSize: 8, border: `1px solid ${C.border}`, borderRadius: 2, background: "transparent", color: C.inkFaint, cursor: "pointer" }}>+</button>
                </div>
              )}
            </div>

            {/* Known metamagic */}
            {spellData.metamagic.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", borderBottom: `1px solid ${C.border}22` }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid ${C.meta}`, background: C.meta, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 9, fontWeight: 700, fontFamily: "serif", color: C.ink }}>{m.name}</span>
                <span style={{ fontSize: 7.5, color: C.meta, fontFamily: "serif" }}>{m.costPerUse} SP</span>
                {m.description && <span style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description}</span>}
                {isMyChar && (
                  <button onClick={() => save({ ...spellData, metamagic: spellData.metamagic.filter((_, j) => j !== i) })}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <Trash2 size={7} color={C.inkFaint} />
                  </button>
                )}
              </div>
            ))}
            {spellData.metamagic.length === 0 && <p style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", margin: "4px 0" }}>No metamagic known</p>}
            {isMyChar && (
              showAddMeta
                ? <AddMetamagicForm onAdd={m => save({ ...spellData, metamagic: [...spellData.metamagic, m] })} onClose={() => setShowAddMeta(false)} />
                : <button onClick={() => setShowAddMeta(true)}
                    style={{ width: "100%", marginTop: 4, padding: "3px", fontSize: 7.5, fontFamily: "serif", fontWeight: 700, color: C.meta, border: `1px dashed ${C.meta}55`, borderRadius: 3, background: "transparent", cursor: "pointer" }}>
                    + Add Metamagic
                  </button>
            )}
          </Sub>

          {/* ── Custom Resources ── */}
          <Sub label="Class Resources" color={C.gold} defaultOpen={spellData.customResources.length > 0}>
            {spellData.customResources.length === 0 && (
              <p style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", margin: "4px 0" }}>
                No resources added (Ki, Bardic Inspiration, Action Surge…)
              </p>
            )}
            {spellData.customResources.map((r, i) => (
              <ResourceRow key={r.id} resource={r} isMyChar={isMyChar}
                onUpdate={updated => save({ ...spellData, customResources: spellData.customResources.map((x, j) => j === i ? updated : x) })}
                onDelete={() => save({ ...spellData, customResources: spellData.customResources.filter((_, j) => j !== i) })}
              />
            ))}
            {isMyChar && (
              showAddResource
                ? <AddResourceForm onAdd={r => save({ ...spellData, customResources: [...spellData.customResources, r] })} onClose={() => setShowAddResource(false)} />
                : <button onClick={() => setShowAddResource(true)}
                    style={{ width: "100%", marginTop: 4, padding: "3px", fontSize: 7.5, fontFamily: "serif", fontWeight: 700, color: C.gold, border: `1px dashed ${C.gold}55`, borderRadius: 3, background: "transparent", cursor: "pointer" }}>
                    + Add Resource (Ki, Bardic Inspiration, Superiority Dice…)
                  </button>
            )}
          </Sub>

          {/* ── Cantrips ── */}
          {(cantrips.length > 0 || isMyChar) && (
            <Sub label="Cantrips (∞)" color={C.gold} defaultOpen={cantrips.length > 0}>
              {cantrips.map(s => (
                <SpellRow key={s.name} spell={s} hasSlot={true} isMyChar={isMyChar}
                  onCast={() => {}}
                  onDelete={() => save({ ...spellData, spells: spellData.spells.filter(x => x !== s) })}
                />
              ))}
              {cantrips.length === 0 && <p style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", margin: "4px 0" }}>No cantrips</p>}
            </Sub>
          )}

          {/* ── Standard Spells by level ── */}
          {(Object.keys(spellsByLevel(standardSpells)).length > 0 || isMyChar) && (
            <Sub label="Prepared Spells" color={C.purple}>
              {Object.entries(spellsByLevel(standardSpells)).sort(([a],[b]) => Number(a)-Number(b)).map(([lvl, lvlSpells]) => {
                const l = Number(lvl);
                const slot = spellData.slots[l];
                const rem = slot ? slot.total - slot.used : 0;
                const color = levelColor(l);
                return (
                  <div key={lvl} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 7.5, fontWeight: 700, fontFamily: "serif", color, textTransform: "uppercase", letterSpacing: "0.08em" }}>Level {lvl}</span>
                      {slot && <span style={{ fontSize: 7.5, color: rem > 0 ? color : C.inkFaint, fontFamily: "serif" }}>({rem}/{slot.total} slots)</span>}
                      {is3e && <span style={{ fontSize: 7.5, color: C.purple, fontFamily: "serif" }}>DC {spellSaveDcFor3e(l, abilityMod)}</span>}
                    </div>
                    {lvlSpells.map(s => (
                      <SpellRow key={s.name} spell={s} hasSlot={rem > 0} isMyChar={isMyChar}
                        onCast={() => handleCast(s)}
                        onDelete={() => save({ ...spellData, spells: spellData.spells.filter(x => x !== s) })}
                      />
                    ))}
                  </div>
                );
              })}
              {standardSpells.length === 0 && <p style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", margin: "4px 0" }}>No spells added yet</p>}
            </Sub>
          )}

          {/* ── Epic Spells ── */}
          {(epicSpells.length > 0) && (
            <Sub label="★ Epic Spells (10+)" color={C.epic}>
              {Object.entries(spellsByLevel(epicSpells)).sort(([a],[b]) => Number(a)-Number(b)).map(([lvl, lvlSpells]) => {
                const l = Number(lvl);
                const slot = spellData.epicSlots[l];
                const rem = slot ? slot.total - slot.used : 0;
                const color = levelColor(l);
                return (
                  <div key={lvl} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 7.5, fontWeight: 700, fontFamily: "serif", color, textTransform: "uppercase" }}>★ Level {lvl}</span>
                      {slot && <span style={{ fontSize: 7.5, color: rem > 0 ? color : C.inkFaint, fontFamily: "serif" }}>({rem}/{slot.total} slots)</span>}
                    </div>
                    {lvlSpells.map(s => (
                      <SpellRow key={s.name} spell={s} hasSlot={rem > 0} isMyChar={isMyChar}
                        onCast={() => handleCast(s)}
                        onDelete={() => save({ ...spellData, spells: spellData.spells.filter(x => x !== s) })}
                      />
                    ))}
                  </div>
                );
              })}
            </Sub>
          )}

          {/* ── Add spell button ── */}
          {isMyChar && (
            showAddSpell
              ? <AddSpellForm onAdd={s => save({ ...spellData, spells: [...spellData.spells, s] })} onClose={() => setShowAddSpell(false)} allowEpic />
              : <button onClick={() => setShowAddSpell(true)}
                  style={{ width: "100%", marginTop: 4, padding: "4px", fontSize: 8, fontFamily: "serif", fontWeight: 700, color: C.purple, border: `1px dashed ${C.purple}66`, borderRadius: 4, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Plus size={8} color={C.purple} /> Add Spell / Ability
                </button>
          )}
        </div>
      )}
    </div>
  );
}

// Fix missing C.inkMid reference
const inkMid = C.inkMid;
