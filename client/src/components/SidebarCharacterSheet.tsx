/**
 * SidebarCharacterSheet
 *
 * Parchment-style in-session D&D character sheet.
 * Modelled on the official 2014 + 2024 WotC sheets:
 *   – Character identity strip
 *   – 6 ability score boxes with modifier
 *   – Saving Throws + Skills with proficiency dots
 *   – Combat stats (AC, Initiative, Speed, HP, Temp HP, Hit Dice, Death Saves)
 *   – Attacks table
 *   – Features & Traits
 *   – Interactive Inventory (consumables have "Use" button, removes item)
 *   – Possessions (mounts, vessels, property, creatures, retainers)
 *   – Spells / Cantrips
 *
 * All sections are collapsible. HP is editable in-place.
 */

import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Character, Item } from "@shared/schema";
import {
  ChevronDown, ChevronUp, Plus, Trash2, Zap, Package,
  Shield, Users, BookOpen, Scroll, Star, Swords, FlaskConical,
  Eye, Loader2, MapPin, Sparkles, Home,
} from "lucide-react";
import SpellSheet from "./SpellSheet";

// ── Parchment colour palette ────────────────────────────────────────────────
const C = {
  paper:     "#f4e9c9",
  paperDark: "#e8d49e",
  paperDeep: "#dfc48a",
  ink:       "#1a0f00",
  inkMid:    "#4a2e0e",
  inkLight:  "#8a6830",
  inkFaint:  "#c4a87a",
  crimson:   "#7a1515",
  crimsonBg: "#7a151514",
  gold:      "#b8880a",
  green:     "#1a5c1a",
  greenBg:   "#1a5c1a18",
  border:    "#c4a265",
  borderDark:"#9a7835",
  shadow:    "rgba(26,15,0,0.15)",
};

// ── Types ────────────────────────────────────────────────────────────────────
interface SheetSection { label: string; entries: Array<{ key: string; value: string }> }

function parseSections(characterData: string): SheetSection[] {
  try { return JSON.parse(characterData || "{}").sections || []; } catch { return []; }
}

function modStr(score: string | number): string {
  const n = parseInt(String(score));
  if (isNaN(n)) return "—";
  const m = Math.floor((n - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

// ── Shared styled box ────────────────────────────────────────────────────────
function ParchmentBox({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      border: `1.5px solid ${C.border}`,
      borderRadius: 5,
      background: C.paperDark,
      boxShadow: `inset 0 1px 2px ${C.shadow}`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon?: any; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 4, marginBottom: 6,
    }}>
      {Icon && <Icon size={9} color={C.crimson} />}
      <span style={{
        fontSize: 8, fontWeight: 900, letterSpacing: "0.15em",
        color: C.crimson, textTransform: "uppercase", fontFamily: "serif",
      }}>{label}</span>
    </div>
  );
}

function CollapsibleSection({
  icon, label, children, defaultOpen = true,
}: { icon?: any; label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", background: "none", border: "none",
          cursor: "pointer", padding: "0 0 4px 0",
          borderBottom: `1.5px solid ${C.borderDark}`,
          marginBottom: open ? 8 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {icon && (() => { const I = icon; return <I size={10} color={C.crimson} />; })()}
          <span style={{
            fontSize: 8, fontWeight: 900, letterSpacing: "0.15em",
            color: C.crimson, textTransform: "uppercase", fontFamily: "serif",
          }}>{label}</span>
        </div>
        {open
          ? <ChevronUp size={9} color={C.inkFaint} />
          : <ChevronDown size={9} color={C.inkFaint} />
        }
      </button>
      {open && children}
    </div>
  );
}

// ── Ability Score Box ────────────────────────────────────────────────────────
function AbilityBox({ label, value }: { label: string; value: string }) {
  const isInfinite = value === "100" || value?.toLowerCase() === "infinite" || value === "∞";
  const display = isInfinite ? "∞" : value || "—";
  const modifier = isInfinite ? "+∞" : modStr(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
      <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: "0.1em", color: C.crimson, fontFamily: "serif", textTransform: "uppercase" }}>{label}</span>
      <div style={{
        width: 38, height: 46, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 1,
        border: `2px solid ${C.border}`, borderRadius: "5px 5px 18px 18px",
        background: C.paper, boxShadow: `inset 0 2px 4px ${C.shadow}`,
      }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: C.ink, fontFamily: "serif", lineHeight: 1 }}>{display}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.crimson, fontFamily: "serif" }}>{modifier}</span>
      </div>
    </div>
  );
}

// ── Skill/Saving Throw Row ───────────────────────────────────────────────────
function SkillRow({ proficient, label, bonus }: { proficient?: boolean; label: string; bonus?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "1.5px 0" }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        border: `1.5px solid ${C.borderDark}`,
        background: proficient ? C.inkMid : "transparent",
        flexShrink: 0,
      }} />
      {bonus && (
        <span style={{ fontSize: 8.5, fontWeight: 700, color: C.ink, fontFamily: "serif", width: 22, textAlign: "right" }}>
          {bonus}
        </span>
      )}
      <span style={{ fontSize: 8.5, color: C.inkMid, fontFamily: "serif", flex: 1 }}>{label}</span>
    </div>
  );
}

// ── Combat Stat Bubble ───────────────────────────────────────────────────────
function CombatBubble({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <ParchmentBox style={{ padding: "4px 2px", minWidth: 36 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, fontFamily: "serif", lineHeight: 1 }}>
          {String(value) === "0" || String(value) === "" ? "—" : value}
        </div>
      </ParchmentBox>
      <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.06em", color: C.inkLight, fontFamily: "serif", marginTop: 2, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

// ── HP Tracker ───────────────────────────────────────────────────────────────
function HPTracker({ character, onHpChange }: { character: Character; onHpChange: (hp: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(character.hp));
  const inputRef = useRef<HTMLInputElement>(null);

  const sections = parseSections((character as any).characterData || "{}");
  const isInfinite = sections.some(s =>
    s.entries.some(e => e.key.toLowerCase() === "hp" && e.value.toLowerCase().includes("infinite"))
  );

  const hp = character.hp;
  const maxHp = character.maxHp;
  const pct = isInfinite ? 100 : maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0;
  const barColor = isInfinite ? C.crimson : pct > 60 ? C.green : pct > 25 ? C.gold : C.crimson;

  const commit = () => {
    const n = parseInt(val);
    if (!isNaN(n)) onHpChange(Math.max(0, Math.min(maxHp, n)));
    setEditing(false);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <SectionLabel icon={undefined} label="Hit Points" />
      {/* HP row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        {/* Current HP */}
        <ParchmentBox style={{ flex: 2, padding: "3px 6px", textAlign: "center", cursor: "pointer" }}
          onClick={() => { setEditing(true); setVal(String(hp)); setTimeout(() => inputRef.current?.select(), 50); }}
        >
          {editing ? (
            <input
              ref={inputRef}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: "serif", fontSize: 14, fontWeight: 900, color: C.ink, textAlign: "center" }}
              value={val}
              onChange={e => setVal(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            />
          ) : (
            <span style={{ fontSize: 14, fontWeight: 900, color: C.ink, fontFamily: "serif" }}>
              {isInfinite ? "∞" : hp}
            </span>
          )}
        </ParchmentBox>
        <span style={{ fontSize: 10, color: C.inkFaint, fontFamily: "serif" }}>/</span>
        <ParchmentBox style={{ flex: 2, padding: "3px 6px", textAlign: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: C.inkMid, fontFamily: "serif" }}>
            {isInfinite ? "∞" : maxHp}
          </span>
        </ParchmentBox>
        <span style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", flex: 1, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>max</span>
      </div>
      {/* HP bar */}
      <div style={{ height: 6, background: `${C.border}55`, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: barColor,
          borderRadius: 3, transition: "width 0.4s ease",
          backgroundImage: isInfinite
            ? `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)`
            : undefined,
        }} />
      </div>
      {/* +/- buttons */}
      {!isInfinite && (
        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
          {[-10, -5, -1].map(d => (
            <button key={d} onClick={() => onHpChange(Math.max(0, hp + d))}
              style={{ padding: "2px 5px", fontSize: 8, fontWeight: 700, fontFamily: "serif", color: C.crimson, background: C.crimsonBg, border: `1px solid ${C.crimson}55`, borderRadius: 3, cursor: "pointer" }}>
              {d}
            </button>
          ))}
          <div style={{ width: 1, background: C.border, margin: "0 2px" }} />
          {[1, 5, 10].map(d => (
            <button key={d} onClick={() => onHpChange(Math.min(maxHp, hp + d))}
              style={{ padding: "2px 5px", fontSize: 8, fontWeight: 700, fontFamily: "serif", color: C.green, background: C.greenBg, border: `1px solid ${C.green}55`, borderRadius: 3, cursor: "pointer" }}>
              +{d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Death Saves ──────────────────────────────────────────────────────────────
function DeathSaves({ status }: { status: string }) {
  const isDead = status === "dead";
  const isUncon = status === "unconscious";
  return (
    <div>
      <SectionLabel label="Death Saves" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {["Successes", "Failures"].map((row, ri) => (
          <div key={row} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 8, color: ri === 0 ? C.green : C.crimson, fontFamily: "serif", width: 52 }}>{row}</span>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%",
                border: `1.5px solid ${ri === 0 ? C.green : C.crimson}`,
                background: (isDead && ri === 1) || (isUncon && ri === 0 && i < 3) ? (ri === 0 ? C.green : C.crimson) : "transparent",
              }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Item type config ─────────────────────────────────────────────────────────
const ITEM_TYPE_CONFIG: Record<string, { label: string; icon: any; isPossession: boolean; color: string }> = {
  consumable: { label: "Consumables",    icon: FlaskConical, isPossession: false, color: C.crimson },
  weapon:     { label: "Weapons",        icon: Swords,       isPossession: false, color: C.inkMid },
  armor:      { label: "Armor & Shields", icon: Shield,      isPossession: false, color: C.inkMid },
  magic:      { label: "Magic Items",    icon: Sparkles,     isPossession: false, color: "#5a2080" },
  gear:       { label: "Gear",           icon: Package,      isPossession: false, color: C.inkMid },
  key:        { label: "Quest Items",    icon: Scroll,       isPossession: false, color: C.gold },
  currency:   { label: "Currency",       icon: Star,         isPossession: false, color: C.gold },
  misc:       { label: "Miscellaneous",  icon: Package,      isPossession: false, color: C.inkMid },
  mount:      { label: "Mounts",         icon: Zap,          isPossession: true,  color: C.inkMid },
  vessel:     { label: "Vessels",        icon: Scroll,       isPossession: true,  color: "#1a4a7a" },
  property:   { label: "Property",       icon: Home,         isPossession: true,  color: C.gold },
  vehicle:    { label: "Vehicles",       icon: Zap,          isPossession: true,  color: C.inkMid },
  creature:   { label: "Creatures",      icon: Zap,          isPossession: true,  color: C.green },
  retainer:   { label: "Retainers",      icon: Users,        isPossession: true,  color: "#5a2080" },
};

// ── Single Item Row ──────────────────────────────────────────────────────────
function ItemRow({
  item, characterId, campaignId, isMyChar,
}: { item: Item; characterId: number; campaignId: number; isMyChar: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const useMutation_ = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/items/${item.id}/use`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", characterId, "items"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/items/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", characterId, "items"] });
    },
  });

  const identifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/items/${item.id}/identify`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", characterId, "items"] });
    },
  });

  const config = ITEM_TYPE_CONFIG[item.itemType] || ITEM_TYPE_CONFIG.misc;
  const displayName = item.identified ? item.name : `${item.name} (Unidentified)`;
  const isLoading = useMutation_.isPending || deleteMutation.isPending || identifyMutation.isPending;

  return (
    <div style={{
      borderBottom: `1px solid ${C.border}44`,
      paddingBottom: 4, marginBottom: 4,
    }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Name + qty */}
        <div
          style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
          onClick={() => setExpanded(e => !e)}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, fontFamily: "serif",
              color: item.identified ? C.ink : C.inkLight,
              fontStyle: item.identified ? "normal" : "italic",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {displayName}
            </span>
            {item.quantity > 1 && (
              <span style={{ fontSize: 8, color: C.inkLight, fontFamily: "serif" }}>×{item.quantity}</span>
            )}
            {item.charges !== null && (
              <span style={{ fontSize: 8, color: "#5a2080", fontFamily: "serif" }}>({item.charges}/{item.maxCharges} charges)</span>
            )}
            {item.equipped && (
              <span style={{
                fontSize: 7, fontWeight: 700, padding: "0 3px",
                background: C.greenBg, border: `1px solid ${C.green}55`,
                borderRadius: 2, color: C.green, fontFamily: "serif",
              }}>E</span>
            )}
            {item.source === "dm" && (
              <span style={{ fontSize: 7, color: C.gold, fontFamily: "serif" }}>✦</span>
            )}
          </div>
        </div>

        {/* Action buttons — only for own character */}
        {isMyChar && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {isLoading ? (
              <Loader2 size={10} color={C.inkFaint} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <>
                {/* Use button — consumables & magic */}
                {(item.consumable || item.charges !== null) && (
                  <button
                    onClick={() => useMutation_.mutate()}
                    title="Use item"
                    style={{
                      padding: "1px 5px", fontSize: 7.5, fontWeight: 700, fontFamily: "serif",
                      color: C.crimson, background: C.crimsonBg,
                      border: `1px solid ${C.crimson}66`, borderRadius: 3, cursor: "pointer",
                    }}>
                    Use
                  </button>
                )}
                {/* Identify */}
                {!item.identified && (
                  <button
                    onClick={() => identifyMutation.mutate()}
                    title="Identify item"
                    style={{
                      padding: "1px 4px", background: "none",
                      border: `1px solid ${C.gold}66`, borderRadius: 3, cursor: "pointer",
                    }}>
                    <Eye size={8} color={C.gold} />
                  </button>
                )}
                {/* Equip toggle for weapons/armor */}
                {(item.itemType === "weapon" || item.itemType === "armor" || item.itemType === "magic") && (
                  <button
                    onClick={() => {
                      apiRequest("PATCH", `/api/items/${item.id}`, { equipped: !item.equipped })
                        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/characters", characterId, "items"] }));
                    }}
                    title={item.equipped ? "Unequip" : "Equip"}
                    style={{
                      padding: "1px 4px", background: "none",
                      border: `1px solid ${item.equipped ? C.green : C.border}`, borderRadius: 3, cursor: "pointer",
                    }}>
                    <Shield size={8} color={item.equipped ? C.green : C.inkFaint} />
                  </button>
                )}
                {/* Remove */}
                <button
                  onClick={() => deleteMutation.mutate()}
                  title="Remove item"
                  style={{ padding: "1px 4px", background: "none", border: "none", cursor: "pointer" }}>
                  <Trash2 size={8} color={C.inkFaint} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Expanded description */}
      {expanded && (item.description || item.locationNote) && (
        <div style={{ paddingTop: 3, paddingLeft: 4 }}>
          {item.description && (
            <p style={{ fontSize: 8.5, color: C.inkMid, fontFamily: "serif", fontStyle: "italic", margin: "0 0 2px 0", lineHeight: 1.4 }}>
              {item.identified ? item.description : "??? — Item not yet identified."}
            </p>
          )}
          {item.locationNote && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
              <MapPin size={7} color={C.inkFaint} />
              <span style={{ fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic" }}>
                {item.locationNote}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Item Form ────────────────────────────────────────────────────────────
function AddItemForm({ characterId, campaignId, onDone }: { characterId: number; campaignId: number; onDone: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("gear");
  const [qty, setQty] = useState(1);
  const [consumable, setConsumable] = useState(false);
  const [identified, setIdentified] = useState(true);
  const [locationNote, setLocationNote] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/characters/${characterId}/items`, {
        name, description: desc, itemType: type, quantity: qty,
        consumable, identified, locationNote, source: "manual",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", characterId, "items"] });
      onDone();
    },
  });

  const isPossession = ["mount","vessel","property","vehicle","creature","retainer"].includes(type);

  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.border}`, borderRadius: 5,
      padding: 8, marginTop: 6,
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: C.crimson, fontFamily: "serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        Add Item / Possession
      </div>

      {/* Name */}
      <input
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        style={{ width: "100%", fontSize: 9, fontFamily: "serif", padding: "3px 5px", marginBottom: 4, border: `1px solid ${C.border}`, borderRadius: 3, background: C.paperDark, color: C.ink, outline: "none", boxSizing: "border-box" }}
      />

      {/* Type */}
      <select
        value={type} onChange={e => { setType(e.target.value); setConsumable(e.target.value === "consumable"); }}
        style={{ width: "100%", fontSize: 9, fontFamily: "serif", padding: "3px 5px", marginBottom: 4, border: `1px solid ${C.border}`, borderRadius: 3, background: C.paperDark, color: C.ink, outline: "none", boxSizing: "border-box" }}
      >
        <optgroup label="Carried Items">
          <option value="consumable">Consumable (potion, scroll, bomb)</option>
          <option value="weapon">Weapon</option>
          <option value="armor">Armor / Shield</option>
          <option value="magic">Magic Item</option>
          <option value="gear">Gear / Tools</option>
          <option value="key">Quest Item / Key</option>
          <option value="currency">Currency / Treasure</option>
          <option value="misc">Miscellaneous</option>
        </optgroup>
        <optgroup label="Possessions">
          <option value="mount">Mount (horse, direwolf...)</option>
          <option value="vessel">Vessel (ship, boat...)</option>
          <option value="property">Property (tavern, estate...)</option>
          <option value="vehicle">Vehicle (wagon, carriage...)</option>
          <option value="creature">Creature / Familiar / Pet</option>
          <option value="retainer">Retainer / Hireling</option>
        </optgroup>
      </select>

      {/* Description */}
      <input
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        style={{ width: "100%", fontSize: 9, fontFamily: "serif", padding: "3px 5px", marginBottom: 4, border: `1px solid ${C.border}`, borderRadius: 3, background: C.paperDark, color: C.ink, outline: "none", boxSizing: "border-box" }}
      />

      {/* Location note for possessions */}
      {isPossession && (
        <input
          placeholder="Location (e.g. Stabled at the Silver Horse Inn)"
          value={locationNote}
          onChange={e => setLocationNote(e.target.value)}
          style={{ width: "100%", fontSize: 9, fontFamily: "serif", padding: "3px 5px", marginBottom: 4, border: `1px solid ${C.border}`, borderRadius: 3, background: C.paperDark, color: C.ink, outline: "none", boxSizing: "border-box" }}
        />
      )}

      {/* Qty + flags */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        {!isPossession && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>Qty</span>
            <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              style={{ width: 36, fontSize: 9, fontFamily: "serif", padding: "2px 4px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.paperDark, color: C.ink, outline: "none" }} />
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
          <input type="checkbox" checked={consumable} onChange={e => setConsumable(e.target.checked)}
            style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>Consumable</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
          <input type="checkbox" checked={!identified} onChange={e => setIdentified(!e.target.checked)}
            style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 8, color: C.inkMid, fontFamily: "serif" }}>Unidentified</span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 5 }}>
        <button onClick={onDone}
          style={{ flex: 1, fontSize: 8, fontFamily: "serif", padding: "4px", border: `1px solid ${C.border}`, borderRadius: 3, background: "transparent", color: C.inkMid, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          onClick={() => addMutation.mutate()}
          disabled={!name.trim() || addMutation.isPending}
          style={{ flex: 2, fontSize: 8, fontWeight: 700, fontFamily: "serif", padding: "4px", border: `1px solid ${C.crimson}`, borderRadius: 3, background: C.crimsonBg, color: C.crimson, cursor: "pointer" }}>
          {addMutation.isPending ? "Adding..." : "Add"}
        </button>
      </div>
    </div>
  );
}

// ── Inventory Panel ──────────────────────────────────────────────────────────
function InventoryPanel({ character, isMyChar }: { character: Character; isMyChar: boolean }) {
  const [showAdd, setShowAdd] = useState(false);

  const { data: allItems = [] } = useQuery<Item[]>({
    queryKey: ["/api/characters", character.id, "items"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/characters/${character.id}/items`);
      return res.json();
    },
  });

  const carryItems = allItems.filter(i => !ITEM_TYPE_CONFIG[i.itemType]?.isPossession);
  const possessions = allItems.filter(i => ITEM_TYPE_CONFIG[i.itemType]?.isPossession);

  // Group carried items by type
  const carryGroups = Object.entries(ITEM_TYPE_CONFIG)
    .filter(([, cfg]) => !cfg.isPossession)
    .map(([type, cfg]) => ({ type, cfg, items: carryItems.filter(i => i.itemType === type) }))
    .filter(g => g.items.length > 0);

  const possGroups = Object.entries(ITEM_TYPE_CONFIG)
    .filter(([, cfg]) => cfg.isPossession)
    .map(([type, cfg]) => ({ type, cfg, items: possessions.filter(i => i.itemType === type) }))
    .filter(g => g.items.length > 0);

  return (
    <CollapsibleSection icon={Package} label="Equipment & Possessions">
      {/* Carried items */}
      {carryGroups.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {carryGroups.map(({ type, cfg, items: groupItems }) => {
            const Icon = cfg.icon;
            return (
              <div key={type} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                  <Icon size={8} color={cfg.color} />
                  <span style={{ fontSize: 7.5, fontWeight: 700, color: cfg.color, fontFamily: "serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {cfg.label}
                  </span>
                </div>
                {groupItems.map(item => (
                  <ItemRow key={item.id} item={item} characterId={character.id} campaignId={character.campaignId} isMyChar={isMyChar} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Possessions */}
      {possGroups.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7.5, fontWeight: 900, color: C.gold, fontFamily: "serif", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: `1px dashed ${C.border}`, paddingBottom: 3, marginBottom: 5 }}>
            Possessions
          </div>
          {possGroups.map(({ type, cfg, items: groupItems }) => {
            const Icon = cfg.icon;
            return (
              <div key={type} style={{ marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                  <Icon size={8} color={cfg.color} />
                  <span style={{ fontSize: 7.5, fontWeight: 700, color: cfg.color, fontFamily: "serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {cfg.label}
                  </span>
                </div>
                {groupItems.map(item => (
                  <ItemRow key={item.id} item={item} characterId={character.id} campaignId={character.campaignId} isMyChar={isMyChar} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {allItems.length === 0 && (
        <p style={{ fontSize: 8.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", textAlign: "center", margin: "8px 0" }}>
          No items yet
        </p>
      )}

      {/* DM-granted indicator */}
      {allItems.some(i => i.source === "dm") && (
        <p style={{ fontSize: 7.5, color: C.gold, fontFamily: "serif", marginTop: 4 }}>
          ✦ = granted by the DM during play
        </p>
      )}

      {/* Add item button */}
      {isMyChar && (
        showAdd ? (
          <AddItemForm characterId={character.id} campaignId={character.campaignId} onDone={() => setShowAdd(false)} />
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              width: "100%", marginTop: 6, padding: "4px",
              fontSize: 8, fontFamily: "serif", fontWeight: 700,
              color: C.inkLight, background: "transparent",
              border: `1px dashed ${C.border}`, borderRadius: 4,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
            <Plus size={8} color={C.inkLight} /> Add Item / Possession
          </button>
        )
      )}
    </CollapsibleSection>
  );
}

// ── Attacks Table ─────────────────────────────────────────────────────────────
function AttacksPanel({ sections }: { sections: SheetSection[] }) {
  const attackSection = sections.find(s => {
    const l = s.label.toLowerCase();
    return l.includes("attack") || l.includes("weapon") || l.includes("combat");
  });
  if (!attackSection?.entries.length) return null;

  return (
    <CollapsibleSection icon={Swords} label="Attacks & Spellcasting">
      <div style={{ fontSize: 8 }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 80px", gap: 3, borderBottom: `1px solid ${C.border}`, paddingBottom: 3, marginBottom: 4 }}>
          {["Name", "Atk", "Damage / Type"].map(h => (
            <span key={h} style={{ fontSize: 7.5, fontWeight: 700, color: C.crimson, fontFamily: "serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>
        {attackSection.entries.map((e, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 50px 80px", gap: 3, padding: "2px 0", borderBottom: `1px solid ${C.border}22` }}>
            <span style={{ fontSize: 8.5, fontFamily: "serif", color: C.ink }}>{e.key}</span>
            <span style={{ fontSize: 8.5, fontFamily: "serif", color: C.inkMid }}>—</span>
            <span style={{ fontSize: 8.5, fontFamily: "serif", color: C.inkMid }}>{e.value}</span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// ── Spells Panel ──────────────────────────────────────────────────────────────
function SpellsPanel({ sections }: { sections: SheetSection[] }) {
  const spellSection = sections.find(s => {
    const l = s.label.toLowerCase();
    return l.includes("spell") || l.includes("magic") || l.includes("cantrip");
  });
  const slotSection = sections.find(s => s.label.toLowerCase().includes("slot"));
  if (!spellSection && !slotSection) return null;

  return (
    <CollapsibleSection icon={Sparkles} label="Spells" defaultOpen={false}>
      {slotSection && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, color: C.crimson, fontFamily: "serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Spell Slots</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {slotSection.entries.map((e, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <ParchmentBox style={{ padding: "2px 5px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "serif", color: C.ink }}>{e.value}</span>
                </ParchmentBox>
                <div style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", marginTop: 1 }}>{e.key}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {spellSection && (
        <div>
          {spellSection.entries.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ fontSize: 8.5, fontFamily: "serif", color: C.ink }}>{e.key}</span>
              <span style={{ fontSize: 8, fontFamily: "serif", color: C.inkLight }}>{e.value}</span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Generic extra sections (features, custom, etc.) ──────────────────────────
function ExtraSection({ section }: { section: SheetSection }) {
  const l = section.label.toLowerCase();
  const skip = ["ability", "stat", "attr", "skill", "attack", "weapon", "combat", "spell", "slot", "cantrip", "equipment", "inventory", "gear", "vital", "hp", "hit point"];
  if (skip.some(s => l.includes(s))) return null;

  const icon = l.includes("feature") || l.includes("class") || l.includes("trait") ? BookOpen
    : l.includes("faction") || l.includes("relation") || l.includes("npc") ? Users
    : l.includes("language") || l.includes("proficien") ? Scroll
    : l.includes("power") || l.includes("void") || l.includes("isekai") || l.includes("divine") ? Sparkles
    : l.includes("identity") || l.includes("alias") || l.includes("background") ? Star
    : Package;

  return (
    <CollapsibleSection icon={icon} label={section.label} defaultOpen={false}>
      {section.entries.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 6, padding: "2px 0", borderBottom: `1px solid ${C.border}22` }}>
          <span style={{ fontSize: 8.5, fontWeight: 600, color: C.inkMid, fontFamily: "serif", minWidth: 70, flexShrink: 0 }}>{e.key}</span>
          <span style={{ fontSize: 8.5, color: C.ink, fontFamily: "serif", flex: 1 }}>{e.value}</span>
        </div>
      ))}
    </CollapsibleSection>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
interface Props {
  character: Character;
  isMyChar: boolean;
  onHpChange: (hp: number) => void;
}

export default function SidebarCharacterSheet({ character, isMyChar, onHpChange }: Props) {
  const sections = parseSections((character as any).characterData || "{}");

  // Extract ability scores
  const abilityKeys = ["str","dex","con","int","wis","cha","strength","dexterity","constitution","intelligence","wisdom","charisma"];
  const abilitySectionIdx = sections.findIndex(s => {
    const keys = s.entries.map(e => e.key.toLowerCase().replace(/[^a-z]/g, ""));
    return keys.filter(k => abilityKeys.some(a => k.startsWith(a))).length >= 3;
  });
  const abilitySection = abilitySectionIdx >= 0 ? sections[abilitySectionIdx] : null;
  const abilities: Record<string, string> = {};
  if (abilitySection) {
    abilitySection.entries.forEach(e => {
      const k = e.key.toLowerCase().replace(/[^a-z]/g, "");
      const match = abilityKeys.find(a => k.startsWith(a));
      if (match) abilities[match.slice(0,3).toUpperCase()] = e.value.match(/\d+/)?.[0] ?? e.value;
    });
  }

  // Skill section
  const skillSection = sections.find(s => s.label.toLowerCase().includes("skill"));
  const extraSections = sections.filter((_, i) => i !== abilitySectionIdx);

  return (
    <div style={{
      background: C.paper,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E")`,
      border: `2px solid ${C.borderDark}`,
      borderRadius: 7,
      boxShadow: `3px 4px 16px ${C.shadow}, inset 0 0 50px rgba(196,162,101,0.07)`,
      fontFamily: "serif",
      overflow: "hidden",
    }}>
      {/* ── Identity Header ── */}
      <div style={{
        background: `linear-gradient(180deg, ${C.paperDeep} 0%, ${C.paperDark} 100%)`,
        borderBottom: `2px solid ${C.borderDark}`,
        padding: "10px 12px 8px",
      }}>
        {/* Top ornament */}
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${C.crimson} 30%, ${C.crimson} 70%, transparent)`, borderRadius: 1, marginBottom: 8 }} />

        {/* Name + Level */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, fontFamily: "serif", letterSpacing: "0.02em", lineHeight: 1.1, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {character.name}
            </div>
            <div style={{ fontSize: 9, color: C.inkMid, fontFamily: "serif", fontStyle: "italic", lineHeight: 1.3 }}>
              {character.charClass}{character.race ? ` · ${character.race}` : ""}
            </div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${C.crimson}`, background: C.paperDark, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 1px 4px ${C.shadow}` }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: C.crimson, fontFamily: "serif", lineHeight: 1 }}>{character.level}</span>
            <span style={{ fontSize: 6, color: C.inkFaint, fontFamily: "serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>LVL</span>
          </div>
        </div>

        {/* Bottom ornament */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`, marginTop: 8 }} />
      </div>

      {/* ── Body ── */}
      <div style={{
        padding: "10px 12px",
        maxHeight: "calc(100vh - 260px)",
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: `${C.border} transparent`,
      }}>

        {/* ── Ability Scores ── */}
        {Object.keys(abilities).length >= 3 && (
          <CollapsibleSection icon={Star} label="Ability Scores">
            <div style={{ display: "flex", gap: 4, justifyContent: "space-between" }}>
              {["STR","DEX","CON","INT","WIS","CHA"].map(ab => (
                <AbilityBox key={ab} label={ab} value={abilities[ab] ?? "—"} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Combat Stats ── */}
        <CollapsibleSection icon={Shield} label="Combat">
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <CombatBubble label="AC" value={
              sections.find(s => s.label.toLowerCase().includes("defense") || s.label.toLowerCase().includes("armor"))
                ?.entries.find(e => e.key.toLowerCase().includes("ac") || e.key.toLowerCase().includes("armor class"))
                ?.value ?? "—"
            } />
            <CombatBubble label="Initiative" value={abilities["DEX"] ? modStr(abilities["DEX"]) : "—"} />
            <CombatBubble label="Speed" value={
              sections.find(s => s.label.toLowerCase().includes("combat") || s.label.toLowerCase().includes("vital"))
                ?.entries.find(e => e.key.toLowerCase().includes("speed"))
                ?.value ?? "30"
            } />
            <CombatBubble label="Prof Bonus" value={
              character.level >= 17 ? "+6" : character.level >= 13 ? "+5" : character.level >= 9 ? "+4" : character.level >= 5 ? "+3" : "+2"
            } />
          </div>
          <HPTracker character={character} onHpChange={onHpChange} />
          {(character.status === "unconscious" || character.status === "dead") && (
            <DeathSaves status={character.status} />
          )}
        </CollapsibleSection>

        {/* ── Skills ── */}
        {skillSection && skillSection.entries.length > 0 && (
          <CollapsibleSection icon={Zap} label="Skills" defaultOpen={false}>
            {skillSection.entries.map((e, i) => (
              <SkillRow key={i} label={e.key} bonus={e.value} proficient={e.value?.startsWith("+") && parseInt(e.value) >= 3} />
            ))}
          </CollapsibleSection>
        )}

        {/* ── Traits ── */}
        {character.traits && (
          <CollapsibleSection icon={BookOpen} label="Traits & Personality" defaultOpen={false}>
            <p style={{ fontSize: 8.5, color: C.inkMid, fontFamily: "serif", fontStyle: "italic", lineHeight: 1.55, margin: 0 }}>
              {character.traits}
            </p>
          </CollapsibleSection>
        )}

        {/* ── Attacks ── */}
        <AttacksPanel sections={sections} />

        {/* ── Dedicated interactive Spell Sheet ── */}
        <SpellSheet character={character} isMyChar={isMyChar} />

        {/* ── Inventory & Possessions ── */}
        <InventoryPanel character={character} isMyChar={isMyChar} />

        {/* ── All other sections (powers, features, identity, etc.) ── */}
        {extraSections
          .filter(s => !["skill","attack","weapon","combat","spell","slot","cantrip"].some(k => s.label.toLowerCase().includes(k)))
          .map((s, i) => <ExtraSection key={i} section={s} />)
        }

        {/* ── Backstory ── */}
        {character.backstory && (
          <CollapsibleSection icon={BookOpen} label="Backstory" defaultOpen={false}>
            <p style={{ fontSize: 8.5, color: C.inkMid, fontFamily: "serif", fontStyle: "italic", lineHeight: 1.55, margin: 0 }}>
              {character.backstory}
            </p>
          </CollapsibleSection>
        )}

        {/* Footer ornament */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`, marginTop: 12 }} />
        <div style={{ textAlign: "center", marginTop: 5, fontSize: 7.5, color: C.inkFaint, fontFamily: "serif", fontStyle: "italic", letterSpacing: "0.08em" }}>
          ✦ Dungeons & Dragons ✦
        </div>
      </div>
    </div>
  );
}
