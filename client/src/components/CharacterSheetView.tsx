/**
 * CharacterSheetView — renders parsed character data as a visual D&D-style sheet.
 * All fields are editable inline. Supports non-D&D characters gracefully
 * (custom resources, narrative-only, isekai etc.).
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Shield, Star, Scroll, Package, Users, Zap, BookOpen, Plus, Trash2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SheetSection {
  label: string;
  entries: Array<{ key: string; value: string }>;
}

export interface CharacterSheetData {
  name: string;
  race: string;
  charClass: string;
  level: number | null;
  hp: number | null;
  maxHp: number | null;
  traits: string;
  backstory: string;
  characterData: string; // JSON: { sections: SheetSection[], raw: string }
}

interface Props {
  data: CharacterSheetData;
  onChange: (updated: CharacterSheetData) => void;
}

// ── Stat Box — the classic hexagonal-ish D&D ability score display ─────────────

function StatBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // Parse modifier from value if it's a number
  const num = parseInt(value);
  const mod = !isNaN(num) ? Math.floor((num - 10) / 2) : null;
  const modStr = mod !== null ? (mod >= 0 ? `+${mod}` : `${mod}`) : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="relative w-14 h-16 flex flex-col items-center justify-center border-2 border-border rounded-lg bg-card hover:border-primary/50 transition-colors">
        <input
          className="w-10 text-center text-lg font-bold bg-transparent border-none outline-none text-foreground"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={4}
        />
        {modStr !== null && (
          <span className="text-[11px] font-semibold text-primary">{modStr}</span>
        )}
      </div>
    </div>
  );
}

// ── HP Box ─────────────────────────────────────────────────────────────────────

function HPTracker({ hp, maxHp, onHpChange, onMaxHpChange }: {
  hp: number | null; maxHp: number | null;
  onHpChange: (v: number | null) => void;
  onMaxHpChange: (v: number | null) => void;
}) {
  const pct = (hp != null && maxHp != null && maxHp > 0) ? Math.min(100, (hp / maxHp) * 100) : 0;
  const barColor = pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Heart className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hit Points</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm font-bold">
          <input
            className="w-12 text-center bg-transparent border border-border rounded px-1 py-0.5 text-foreground outline-none focus:border-primary"
            value={hp ?? "∞"}
            onChange={(e) => {
              const v = e.target.value;
              onHpChange(v === "" || v === "∞" ? null : Number(v));
            }}
          />
          <span className="text-muted-foreground">/</span>
          <input
            className="w-12 text-center bg-transparent border border-border rounded px-1 py-0.5 text-foreground outline-none focus:border-primary"
            value={maxHp ?? "∞"}
            onChange={(e) => {
              const v = e.target.value;
              onMaxHpChange(v === "" || v === "∞" ? null : Number(v));
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground">HP</span>
      </div>
      {(hp !== null || maxHp !== null) && (
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {hp === null && maxHp === null && (
        <p className="text-xs text-muted-foreground italic">Non-HP health system — see character sections below</p>
      )}
    </div>
  );
}

// ── Editable section (abilities, skills, equipment, etc.) ─────────────────────

function SheetSectionBlock({
  section,
  onChange,
  onDelete,
}: {
  section: SheetSection;
  onChange: (s: SheetSection) => void;
  onDelete: () => void;
}) {
  const addEntry = () => onChange({ ...section, entries: [...section.entries, { key: "", value: "" }] });
  const removeEntry = (i: number) => onChange({ ...section, entries: section.entries.filter((_, idx) => idx !== i) });
  const updateEntry = (i: number, key: string, value: string) => {
    const entries = [...section.entries];
    entries[i] = { key, value };
    onChange({ ...section, entries });
  };

  // Pick icon by section label
  const icon = (() => {
    const l = section.label.toLowerCase();
    if (l.includes("abil") || l.includes("stat") || l.includes("attr")) return <Star className="w-3.5 h-3.5" />;
    if (l.includes("skill")) return <Zap className="w-3.5 h-3.5" />;
    if (l.includes("equip") || l.includes("inventor") || l.includes("gear") || l.includes("resource")) return <Package className="w-3.5 h-3.5" />;
    if (l.includes("spell") || l.includes("magic") || l.includes("power") || l.includes("abilit")) return <Zap className="w-3.5 h-3.5" />;
    if (l.includes("faction") || l.includes("relation") || l.includes("npc")) return <Users className="w-3.5 h-3.5" />;
    if (l.includes("note") || l.includes("backstory") || l.includes("lore")) return <BookOpen className="w-3.5 h-3.5" />;
    return <Scroll className="w-3.5 h-3.5" />;
  })();

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2 text-primary">
          {icon}
          <input
            className="text-xs font-bold uppercase tracking-wider bg-transparent border-none outline-none text-primary w-full"
            value={section.label}
            onChange={(e) => onChange({ ...section, label: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={addEntry}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Add entry"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="divide-y divide-border/50">
        {section.entries.map((entry, ei) => (
          <div key={ei} className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center px-3 py-1.5">
            <input
              className="text-xs font-medium text-muted-foreground bg-transparent border-none outline-none truncate"
              value={entry.key}
              onChange={(e) => updateEntry(ei, e.target.value, entry.value)}
              placeholder="Property"
            />
            <input
              className="text-xs text-foreground bg-transparent border-none outline-none"
              value={entry.value}
              onChange={(e) => updateEntry(ei, entry.key, e.target.value)}
              placeholder="Value"
            />
            <button
              onClick={() => removeEntry(ei)}
              className="p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {section.entries.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">Empty — add entries above</div>
        )}
      </div>
    </div>
  );
}

// ── D&D-style ability score extractor ─────────────────────────────────────────
// Looks for a section that looks like ability scores and returns it separately

function extractAbilityScores(sections: SheetSection[]): {
  abilities: Record<string, string>;
  sectionIndex: number;
} | null {
  const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha",
    "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const entryKeys = s.entries.map(e => e.key.toLowerCase().replace(/[^a-z]/g, ""));
    const matchCount = entryKeys.filter(k => ABILITY_KEYS.some(a => k.startsWith(a))).length;
    if (matchCount >= 3) {
      const abilities: Record<string, string> = {};
      s.entries.forEach(e => {
        const k = e.key.toLowerCase().replace(/[^a-z]/g, "");
        const short = ABILITY_KEYS.find(a => k.startsWith(a));
        if (short) {
          // Normalise to 3-letter
          const key = short.slice(0, 3).toUpperCase();
          // Extract just the number from value (e.g. "16 (+3)" -> "16")
          const num = e.value.match(/\d+/)?.[0] ?? e.value;
          abilities[key] = num;
        }
      });
      return { abilities, sectionIndex: i };
    }
  }
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CharacterSheetView({ data, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<"sheet" | "notes">("sheet");

  // Parse the characterData blob
  let sections: SheetSection[] = [];
  let rawText = "";
  try {
    const cd = JSON.parse(data.characterData || "{}");
    sections = cd.sections || [];
    rawText = cd.raw || "";
  } catch {}

  const updateSections = (newSections: SheetSection[]) => {
    try {
      const cd = JSON.parse(data.characterData || "{}");
      cd.sections = newSections;
      onChange({ ...data, characterData: JSON.stringify(cd) });
    } catch {
      onChange({ ...data, characterData: JSON.stringify({ sections: newSections, raw: rawText }) });
    }
  };

  const updateSection = (i: number, updated: SheetSection) => {
    const s = [...sections];
    s[i] = updated;
    updateSections(s);
  };

  const deleteSection = (i: number) => updateSections(sections.filter((_, idx) => idx !== i));

  const addSection = () => {
    updateSections([...sections, { label: "Custom Section", entries: [{ key: "", value: "" }] }]);
  };

  // Check if there are standard D&D ability scores to render separately
  const abilityResult = extractAbilityScores(sections);
  const STANDARD_ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

  const updateAbility = (key: string, value: string) => {
    if (!abilityResult) return;
    const s = [...sections];
    const section = { ...s[abilityResult.sectionIndex] };
    const entries = section.entries.map(e => {
      const k = e.key.toLowerCase().replace(/[^a-z]/g, "");
      const short = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
        .find(a => k.startsWith(a));
      if (short && short.slice(0, 3).toUpperCase() === key) {
        return { ...e, value };
      }
      return e;
    });
    s[abilityResult.sectionIndex] = { ...section, entries };
    updateSections(s);
  };

  // Sections excluding ability scores (rendered separately)
  const otherSections = abilityResult
    ? sections.filter((_, i) => i !== abilityResult.sectionIndex)
    : sections;

  const otherSectionOriginalIndices = sections
    .map((_, i) => i)
    .filter(i => !abilityResult || i !== abilityResult.sectionIndex);

  return (
    <div className="w-full space-y-4">
      {/* ── Identity strip ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Decorative header bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
        <div className="p-4 space-y-3">
          {/* Name row */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Character Name</label>
              <input
                className="w-full text-xl font-bold bg-transparent border-b-2 border-border focus:border-primary outline-none text-foreground pb-0.5 transition-colors"
                value={data.name}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="Unnamed Adventurer"
              />
            </div>
            {data.level !== null && (
              <div className="text-center shrink-0">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Level</label>
                <input
                  className="w-12 text-center text-lg font-bold bg-transparent border-2 border-border rounded-lg outline-none focus:border-primary text-foreground transition-colors py-0.5"
                  value={data.level}
                  type="number"
                  min={1} max={99}
                  onChange={(e) => onChange({ ...data, level: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          {/* Class / Race / Background row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Class / Role</label>
              <input
                className="w-full text-sm font-medium bg-transparent border-b border-border focus:border-primary outline-none text-foreground pb-0.5 transition-colors"
                value={data.charClass}
                onChange={(e) => onChange({ ...data, charClass: e.target.value })}
                placeholder="Fighter"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Race / Species</label>
              <input
                className="w-full text-sm font-medium bg-transparent border-b border-border focus:border-primary outline-none text-foreground pb-0.5 transition-colors"
                value={data.race}
                onChange={(e) => onChange({ ...data, race: e.target.value })}
                placeholder="Human"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Ability scores (only if D&D-style detected) ── */}
      {abilityResult && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ability Scores</span>
          </div>
          <div className="grid grid-cols-6 gap-2 justify-items-center">
            {STANDARD_ABILITIES.map((ab) => (
              <StatBox
                key={ab}
                label={ab}
                value={abilityResult.abilities[ab] ?? "—"}
                onChange={(v) => updateAbility(ab, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── HP + Traits (2-column) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <HPTracker
            hp={data.hp}
            maxHp={data.maxHp}
            onHpChange={(v) => onChange({ ...data, hp: v })}
            onMaxHpChange={(v) => onChange({ ...data, maxHp: v })}
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Traits</label>
          </div>
          <textarea
            className="w-full text-xs bg-transparent border-none outline-none resize-none text-foreground leading-relaxed placeholder:text-muted-foreground/50"
            value={data.traits}
            onChange={(e) => onChange({ ...data, traits: e.target.value })}
            placeholder="Personality traits, ideals, bonds, flaws..."
            rows={4}
          />
        </div>
      </div>

      {/* ── Backstory ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Backstory</label>
        </div>
        <textarea
          className="w-full text-xs bg-transparent border-none outline-none resize-none text-foreground leading-relaxed placeholder:text-muted-foreground/50"
          value={data.backstory}
          onChange={(e) => onChange({ ...data, backstory: e.target.value })}
          placeholder="Character history, origin, and motivations..."
          rows={4}
        />
      </div>

      {/* ── Other sections ── */}
      {otherSections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Character Sections — sent to DM verbatim
            </span>
            <button
              onClick={addSection}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add section
            </button>
          </div>
          {otherSections.map((section, localIdx) => {
            const originalIdx = otherSectionOriginalIndices[localIdx];
            return (
              <SheetSectionBlock
                key={originalIdx}
                section={section}
                onChange={(updated) => updateSection(originalIdx, updated)}
                onDelete={() => deleteSection(originalIdx)}
              />
            );
          })}
        </div>
      )}

      {/* Add section button if no sections yet */}
      {otherSections.length === 0 && !abilityResult && (
        <button
          onClick={addSection}
          className="w-full py-3 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add a section (skills, spells, equipment...)
        </button>
      )}
    </div>
  );
}
