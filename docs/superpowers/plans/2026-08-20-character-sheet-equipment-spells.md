# Character Sheet Equipment Tab + Spells Tome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the canonical 3.5e Character Sheet (`client/src/pages/CharacterSheetPage.tsx`) from one page into three tabs — Sheet, Equipment (read-only inventory + feats reference), and Spells (a restyled, ruleset-aware resurrection of the orphaned `SpellSheet.tsx` component).

**Architecture:** Tab state lives in `CharacterSheetPage.tsx` and only renders for `dnd35e` (other rulesets keep today's single-page `GenericSheet`, untouched). Equipment is a new, purely presentational component reading already-fetched data — no new mutations, no new queries. Spells reuses `SpellSheet.tsx`'s existing working data model and interactions (slots, rest, metamagic, resources) unchanged; only its ability-score source, its DC/attack-bonus formula (3.5e-specific, gated by ruleset), and its color palette (swapped to the shared `.dm-shell`/`.dm-tome` tokens `CodexOverlay` already uses) change.

**Tech Stack:** React + TypeScript (client), Vite build, no client test runner beyond direct `node --import tsx --test` on plain-TS files (no JSX, no Playwright in this repo).

## Global Constraints

- 3.5e ruleset only. Gate every new UI behind `isDnd35e` (`sheet.ruleset === "dnd35e"`), mirroring `CharacterSheetPage.tsx`'s existing `Dnd35eSheet` / `GenericSheet` split. Non-3.5e rulesets must render exactly as they do today.
- No new database tables or columns. Spells continue to live in `characterData.spellData` via the existing `PATCH /api/characters/:id/spell-data` route (`server/routes.ts:2248`) — do not touch that route.
- No equip/unequip/use/read actions anywhere on the sheet. Equipment tab is read-only. `client/src/components/game/InventoryOverlay.tsx` remains the sole place inventory state is mutated.
- Never fabricate data. A field with no authoritative backing renders `—` or is omitted — this already applies throughout `CharacterSheetPage.tsx` (see `fmt()`) and must apply to every new field too.
- 5e's spell DC/attack-bonus logic (the code already in `SpellSheet.tsx`) stays exactly as-is and keeps serving as the fallback for any non-3.5e ruleset — do not "fix" it in this plan; that's explicitly deferred to 5e's own future pass.

---

### Task 1: Tab infrastructure on CharacterSheetPage

**Files:**
- Modify: `client/src/pages/CharacterSheetPage.tsx`

**Interfaces:**
- Produces: `activeTab: "sheet" | "equipment" | "spells"` state in `CharacterSheetPage`, and a tab bar rendered only when `isDnd35e` is true. `Dnd35eSheet` stops rendering its own header/identity block and its Feats & Special Abilities section (both move up a level / to Task 2) — everything else in `Dnd35eSheet` is unchanged.
- Consumes: nothing new; uses the existing `character`, `sheet`, `hud`, `raceDef`, `titles`, `featSections`, `weapons`, `isDnd35e` variables already computed in `CharacterSheetPage`.

- [ ] **Step 1: Move the identity/XP header above the tab body and add tab state**

In `client/src/pages/CharacterSheetPage.tsx`, replace the render block (currently lines 158-164):

```tsx
      {character && sheet && hud && (
        isDnd35e ? (
          <Dnd35eSheet character={character} sheet={sheet} hud={hud} raceDef={raceDef} titles={titles} featSections={featSections} weapons={weapons} />
        ) : (
          <GenericSheet character={character} sheet={sheet} hud={hud} raceDef={raceDef} titles={titles} featSections={featSections} weapons={weapons} />
        )
      )}
```

with:

```tsx
      {character && sheet && hud && (
        isDnd35e ? (
          <Dnd35eSheetShell character={character} sheet={sheet} hud={hud} raceDef={raceDef} titles={titles} featSections={featSections} weapons={weapons} items={itemsQuery.data ?? []} />
        ) : (
          <GenericSheet character={character} sheet={sheet} hud={hud} raceDef={raceDef} titles={titles} featSections={featSections} weapons={weapons} />
        )
      )}
```

Then, immediately above the `function Dnd35eSheet(...)` definition (currently line 207), insert the new shell component that owns identity/XP + tabs, and rename the existing function so the shell can call it for the "sheet" tab body:

```tsx
type TabKey = "sheet" | "equipment" | "spells";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "sheet", label: "Sheet" },
  { key: "equipment", label: "Equipment" },
  { key: "spells", label: "Spells" },
];

function Dnd35eSheetShell(props: SheetBodyProps & { items: Item[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("sheet");
  const { character, sheet, titles } = props;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="parchment-surface parchment-ruled rounded-md shadow-lg overflow-hidden">
        {/* Identity + XP — shared across all three tabs */}
        <div className="px-6 py-5 border-b-2 border-[#654a27]/40 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="parchment-heading text-3xl font-bold leading-tight">{character.name}</div>
            <div className="parchment-label text-xs mt-1">
              {character.race} · {character.charClass} · Level {character.level}
            </div>
            {titles && titles.length > 0 && (
              <div className="text-xs italic mt-1 opacity-80">Known as {titles.map((t) => t.title).join(", ")}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="parchment-label text-[10px]">Experience</div>
            <div className="parchment-badge !rounded-md !h-auto !min-w-[64px] px-2 py-1 text-sm tabular-nums">
              {xpDisplay(sheet.xp)}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 pt-3 flex gap-1 border-b border-[#654a27]/25">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`parchment-label text-xs px-3 py-2 -mb-px border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#654a27] opacity-100"
                  : "border-transparent opacity-60 hover:opacity-80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "sheet" && <Dnd35eSheet {...props} />}
        {activeTab === "equipment" && <EquipmentTab items={props.items} featSections={props.featSections} />}
        {activeTab === "spells" && <div className="p-6 text-sm opacity-60">Spells tome coming in Task 4.</div>}
      </div>
    </div>
  );
}
```

Add `useState` to the existing React import (currently `import { useRoute, useLocation } from "wouter";` is the routing import — `useState` comes from `"react"`, which isn't imported yet). Change the top of the file's import block from:

```tsx
import { useRoute, useLocation } from "wouter";
```

to:

```tsx
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
```

- [ ] **Step 2: Strip the identity block and Feats section out of `Dnd35eSheet`, and drop its outer wrapper divs (the shell now owns them)**

In `client/src/pages/CharacterSheetPage.tsx`, replace the entire `Dnd35eSheet` function body (currently lines 207-385) with:

```tsx
function Dnd35eSheet({ hud, raceDef, sheet, character, weapons }: SheetBodyProps) {
  const sortedSkills = sheet.skills.slice().sort((a, b) => a.name.localeCompare(b.name));
  const half = Math.ceil(sortedSkills.length / 2);
  const skillColumns = [sortedSkills.slice(0, half), sortedSkills.slice(half)];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-5 p-6">
        {/* Left rail: ability score boxes */}
        <div className="flex md:flex-col gap-3 flex-wrap">
          {ABILITY_ORDER.map((key) => (
            <div key={key} className="relative flex-1 min-w-[92px] md:min-w-0">
              <div className="border-2 border-[#654a27]/50 rounded-md bg-[#f6ecd2]/70 pt-2 pb-5 text-center">
                <div className="parchment-label text-[10px]">{abilityBoxLabel(key)}</div>
                <div className="parchment-heading text-3xl font-bold leading-none mt-1">{sheet.abilities[key].score}</div>
              </div>
              <div className="parchment-badge absolute left-1/2 -translate-x-1/2 -bottom-3">
                {fmt(sheet.abilities[key].modifier)}
              </div>
            </div>
          ))}
        </div>

        {/* Right column: combat strip, saves, attack, skills */}
        <div className="space-y-5 mt-2 md:mt-0">
          {/* Combat strip */}
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="Hit Points" value={hud.hp ? `${hud.hp.current}/${hud.hp.max}` : "—"} />
            <StatBox label="Armor Class" value={hud.ac !== null ? String(hud.ac) : "—"} />
            <StatBox label="Initiative" value={fmt(hud.initiative)} />
            <StatBox label="Speed" value={hud.speed !== null ? `${hud.speed} ft` : "—"} />
          </div>

          {/* Saving Throws */}
          <div>
            <SectionLabel>Saving Throws</SectionLabel>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {sheet.saves.map((save) => (
                  <tr key={save.key} className="border-b border-[#654a27]/25 last:border-b-0">
                    <td className="py-1.5 parchment-label text-xs">{save.label}</td>
                    <td className="py-1.5 text-xs opacity-70">({saveAbilityHint(save)})</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{fmt(save.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attack */}
          <div>
            <SectionLabel>Base Attack</SectionLabel>
            <div className="text-sm tabular-nums">
              {fmt(sheet.attack.total)}
              {sheet.attack.extraAttackBonuses.length > 0 && (
                <>
                  {" / "}
                  {sheet.attack.extraAttackBonuses.map((b) => fmt(b)).join(" / ")}
                  <span className="text-xs opacity-70"> (full attack)</span>
                </>
              )}
              {" "}
              <span className="text-xs opacity-70">· {character.attacksPerRound} attack{character.attacksPerRound === 1 ? "" : "s"}/round</span>
            </div>
            <div className="text-[11px] opacity-60 mt-0.5">{attackBreakdownLabel(sheet.attack.breakdown)}</div>
          </div>

          {/* Weapons — equipped weapons only, so this stays empty rather
              than listing every carried item; damage dice only shown when
              actually recorded on the item. */}
          <div>
            <SectionLabel>Weapons</SectionLabel>
            {weapons.length === 0 ? (
              <div className="text-xs opacity-60">No weapon equipped.</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-[10px] parchment-label opacity-70">
                    <th className="text-left font-normal pb-1">Weapon</th>
                    <th className="text-right font-normal pb-1">Attack</th>
                    <th className="text-right font-normal pb-1">Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {weapons.map((w) => (
                    <tr key={w.id} className="border-b border-[#654a27]/25 last:border-b-0">
                      <td className="py-1.5">{w.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(sheet.attack.total)}</td>
                      <td className="py-1.5 text-right tabular-nums">{w.weaponDamageDice || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Skills — ruled two-column table */}
      <div className="px-6 pb-6">
        <SectionLabel>Skills</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          {skillColumns.map((col, colIdx) => (
            <table key={colIdx} className="w-full text-sm border-collapse">
              <tbody>
                {col.map((skill) => (
                  <tr key={skill.name} className="border-b border-[#654a27]/15">
                    <td className="py-1 w-4">
                      {skill.proficient && <span className="inline-block w-2 h-2 rounded-sm bg-[#654a27]" aria-label="Trained" />}
                    </td>
                    <td className="py-1">{skill.name}</td>
                    <td className="py-1 text-xs opacity-60 w-10">({skill.ability.toUpperCase()})</td>
                    <td className="py-1 text-right font-medium tabular-nums w-10">{fmt(skill.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>

      {/* Racial traits (Feats moved to the Equipment tab) */}
      {raceDef && (
        <div className="px-6 pb-6">
          <div className="border border-[#654a27]/30 rounded-md p-3">
            <SectionLabel>Racial Traits — {raceDef.displayName}</SectionLabel>
            <div className="text-xs opacity-70 mb-2">
              {raceDef.size === "small" ? "Small" : "Medium"} · {raceDef.speed} ft
              {raceDef.vision.length > 0 ? ` · ${raceDef.vision.join(", ")}` : ""}
            </div>
            <div className="space-y-1.5">
              {raceDef.traits.map((trait) => (
                <div key={trait.name} className="text-sm">
                  <span className="font-semibold">{trait.name}.</span> <span className="opacity-80">{trait.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note what changed versus the original: the outer `<div className="max-w-4xl mx-auto ...">` and `<div className="parchment-surface ...">` wrappers are gone (the shell owns them now), the identity/XP header block is gone (moved to the shell), and the "Racial traits + Feats" two-column grid is now just Racial Traits alone (Feats moved to `EquipmentTab`, built in Task 2 — reference it as a stub for now since Task 2 hasn't created it yet; this step compiles even though `featSections` is temporarily unused by `Dnd35eSheet` because `SheetBodyProps` still declares it and the shell passes it to `EquipmentTab` directly, not through `Dnd35eSheet`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: One error, `Cannot find name 'EquipmentTab'` (Task 2 creates it) — that is the only expected error. If there are other errors, fix them before proceeding (likely causes: forgetting the `useState` import, or a leftover reference to the old `Dnd35eSheet` name in the render block from Step 1).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/CharacterSheetPage.tsx
git commit -m "Add tab infrastructure to the 3.5e character sheet (Sheet/Equipment/Spells)"
```

---

### Task 2: Equipment tab — read-only loadout, full inventory, and feats

**Files:**
- Create: `client/src/components/sheet/EquipmentTab.tsx`
- Modify: `client/src/pages/CharacterSheetPage.tsx` (extend the `Item` type, replace the Task 1 placeholder Spells-tab-adjacent Equipment stub)

**Interfaces:**
- Consumes: `Item[]` (extended shape, see Step 1) and `ParsedSection[]` (the existing `featSections`, already computed by `safeParseFeats` in `CharacterSheetPage.tsx`).
- Produces: `EquipmentTab` component, default export, props `{ items: Item[]; featSections: ParsedSection[] }`. No mutations, no queries — pure presentation.

- [ ] **Step 1: Extend the `Item` type in `CharacterSheetPage.tsx` with the fields Equipment needs**

The current `Item` type (lines 45-53) only has `id, name, itemType, weight, carried, equipped, weaponDamageDice` — enough for the weapons table, not enough for a full inventory reference. Replace it with:

```tsx
type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
  slot: string | null;
  weight: number;
  carried: boolean;
  weaponDamageDice: string | null;
};
```

(This matches the shape the API already returns — `client/src/components/game/InventoryOverlay.tsx`'s `Item` type uses the same fields minus `weaponDamageDice`, which `CharacterSheetPage.tsx` already added for the weapons table.)

- [ ] **Step 2: Create `client/src/components/sheet/EquipmentTab.tsx`**

```tsx
// client/src/components/sheet/EquipmentTab.tsx
//
// Read-only equipment + feats reference for the 3.5e Character Sheet's
// Equipment tab. Deliberately has no equip/unequip/use/read actions —
// client/src/components/game/InventoryOverlay.tsx remains the sole place
// inventory state is mutated (design spec 2026-08-20). This just shows a
// loadout summary and the full item list in the sheet's parchment style.

import { useMemo } from "react";
import {
  Backpack, Sword, Shield, Sparkles, Castle, Car, Ship, Wrench, ScrollText,
  Link as LinkIcon, UserRound, PawPrint, Package,
} from "lucide-react";

type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
  slot: string | null;
  weight: number;
  carried: boolean;
  weaponDamageDice: string | null;
};

type ParsedSection = {
  label: string;
  entries?: Array<{ key?: string; name?: string; value?: string; description?: string }>;
};

type Props = {
  items: Item[];
  featSections: ParsedSection[];
};

// Same 11 slots InventoryOverlay's equipped view uses (EquipmentPaperDoll.tsx),
// duplicated here as a plain label list rather than importing that component:
// EquipmentPaperDoll is dark/leather-themed for the campaign HUD, and reskinning
// it in place would create a visual mismatch everywhere else it's used.
const SLOT_LABELS: Array<{ key: string; label: string }> = [
  { key: "head", label: "Head" },
  { key: "neck", label: "Neck" },
  { key: "chest", label: "Chest" },
  { key: "underclothes", label: "Undergarments" },
  { key: "hands", label: "Hands" },
  { key: "mainHand", label: "Main Hand" },
  { key: "offHand", label: "Off Hand" },
  { key: "ring1", label: "Ring 1" },
  { key: "ring2", label: "Ring 2" },
  { key: "legs", label: "Legs" },
  { key: "feet", label: "Feet" },
];

function getItemTypeMeta(itemType: string) {
  const t = String(itemType || "misc").toLowerCase();
  if (t === "weapon") return { label: "Weapons", icon: Sword };
  if (t === "armor") return { label: "Armor", icon: Shield };
  if (t === "consumable") return { label: "Consumables", icon: Sparkles };
  if (t === "property") return { label: "Property", icon: Castle };
  if (t === "vehicle") return { label: "Vehicles", icon: Car };
  if (t === "vessel") return { label: "Vessels", icon: Ship };
  if (t === "tool") return { label: "Tools", icon: Wrench };
  if (t === "magic") return { label: "Magic Items", icon: ScrollText };
  if (t === "retainer") return { label: "Retainers", icon: UserRound };
  if (t === "mount" || t === "creature") return { label: "Mounts & Creatures", icon: PawPrint };
  if (t === "key") return { label: "Keys", icon: LinkIcon };
  return { label: "Gear & Misc", icon: Package };
}

function groupItems(items: Item[]) {
  const groups = new Map<string, { label: string; icon: any; items: Item[] }>();
  for (const item of items) {
    const meta = getItemTypeMeta(item.itemType);
    if (!groups.has(meta.label)) groups.set(meta.label, { label: meta.label, icon: meta.icon, items: [] });
    groups.get(meta.label)!.items.push(item);
  }
  return Array.from(groups.values());
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="parchment-label text-xs border-b border-[#654a27]/40 pb-1 mb-2">{children}</div>;
}

export default function EquipmentTab({ items, featSections }: Props) {
  const groupedItems = useMemo(() => groupItems(items), [items]);
  const equippedByslot = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items) {
      if (item.equipped && item.slot) map.set(item.slot, item);
    }
    return map;
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      {/* Loadout */}
      <div>
        <SectionLabel>Equipped</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SLOT_LABELS.map((slot) => {
            const item = equippedByslot.get(slot.key);
            return (
              <div key={slot.key} className="border border-[#654a27]/30 rounded-md bg-[#f6ecd2]/50 px-2 py-1.5">
                <div className="text-[9px] parchment-label opacity-70">{slot.label}</div>
                <div className="text-xs mt-0.5 truncate">{item ? item.name : <span className="opacity-40">Empty</span>}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full inventory */}
      <div>
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <Backpack className="w-3 h-3" /> Inventory &amp; Possessions
          </span>
        </SectionLabel>
        {groupedItems.length === 0 ? (
          <div className="text-xs opacity-60">Nothing carried.</div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.label}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold mb-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {group.label}
                  </div>
                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <div key={item.id} className="border-b border-[#654a27]/15 pb-1.5 text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">
                            {item.name}
                            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                          </span>
                          <span className="text-[10px] opacity-60 shrink-0">
                            {item.weight > 0 ? `${Math.round(item.weight * item.quantity * 10) / 10} lb` : ""}
                            {item.equipped ? " · equipped" : item.carried ? "" : " · stored"}
                            {!item.identified ? " · unidentified" : ""}
                          </span>
                        </div>
                        {item.description && (
                          <div className="text-xs opacity-70 mt-0.5 whitespace-pre-wrap">{item.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feats & Special Abilities */}
      {featSections.length > 0 && (
        <div>
          <SectionLabel>Feats &amp; Special Abilities</SectionLabel>
          <div className="space-y-1.5">
            {featSections.flatMap((section) => section.entries ?? []).map((entry, idx) => (
              <div key={`${entry.key || entry.name || "entry"}-${idx}`} className="text-sm">
                <span className="font-semibold">{entry.name || entry.key}.</span>{" "}
                <span className="opacity-80">{entry.description || entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire `EquipmentTab` into `Dnd35eSheetShell`**

In `client/src/pages/CharacterSheetPage.tsx`, add the import:

```tsx
import EquipmentTab from "@/components/sheet/EquipmentTab";
```

Replace the Task 1 placeholder line:

```tsx
        {activeTab === "equipment" && <EquipmentTab items={props.items} featSections={props.featSections} />}
```

(This line already exists from Task 1 — confirm it matches exactly; no change needed if it does.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Start the local dev server (`npm run dev` or the project's existing dev script), sign in as a test user with a 3.5e character that has equipped items, unidentified items, and at least one feat entry in `characterData.sections`. Open the character sheet, click the Equipment tab, and confirm:
- The loadout grid shows equipped items in their correct slots and "Empty" for unoccupied ones.
- The full inventory list shows every item, grouped by type, with weight/equipped/stored/unidentified annotations and full descriptions.
- No equip/unequip/use/read controls appear anywhere on this tab.
- Feats & Special Abilities render below the inventory.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/CharacterSheetPage.tsx client/src/components/sheet/EquipmentTab.tsx
git commit -m "Add read-only Equipment tab (loadout, inventory, feats) to the character sheet"
```

---

### Task 3: 3.5e spell math (pure functions, unit-tested)

**Files:**
- Create: `client/src/lib/spellMath.ts`
- Test: `client/src/lib/spellMath.test.ts`

**Interfaces:**
- Produces: `spellSaveDcFor3e(spellLevel: number, abilityModifier: number): number` and `resolveCastingAbilityScore(abilities: Record<Ability, {score: number; modifier: number}>, castingAbility: string): {score: number; modifier: number} | null` — both consumed by Task 4's `SpellSheet.tsx` changes.
- Consumes: the `Ability` type already exported from `client/src/lib/characterSheetTypes.ts`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/lib/spellMath.test.ts`:

```ts
// client/src/lib/spellMath.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { spellSaveDcFor3e, resolveCastingAbilityScore } from "./spellMath";

test("spellSaveDcFor3e: DC = 10 + spell level + ability modifier", () => {
  assert.equal(spellSaveDcFor3e(0, 3), 13); // cantrip/0-level, +3 mod
  assert.equal(spellSaveDcFor3e(3, 3), 16); // 3rd-level spell, +3 mod
  assert.equal(spellSaveDcFor3e(9, 5), 24); // 9th-level spell, +5 mod
});

test("spellSaveDcFor3e: a negative ability modifier still lowers the DC correctly", () => {
  assert.equal(spellSaveDcFor3e(1, -1), 10);
});

test("resolveCastingAbilityScore: finds the real ability score/modifier by 3-letter key", () => {
  const abilities = {
    str: { score: 10, modifier: 0 },
    dex: { score: 12, modifier: 1 },
    con: { score: 14, modifier: 2 },
    int: { score: 18, modifier: 4 },
    wis: { score: 16, modifier: 3 },
    cha: { score: 8, modifier: -1 },
  };
  assert.deepEqual(resolveCastingAbilityScore(abilities, "INT"), { score: 18, modifier: 4 });
  assert.deepEqual(resolveCastingAbilityScore(abilities, "wis"), { score: 16, modifier: 3 });
});

test("resolveCastingAbilityScore: returns null for a non-ability casting-ability value (e.g. 'Custom')", () => {
  const abilities = {
    str: { score: 10, modifier: 0 }, dex: { score: 10, modifier: 0 }, con: { score: 10, modifier: 0 },
    int: { score: 10, modifier: 0 }, wis: { score: 10, modifier: 0 }, cha: { score: 10, modifier: 0 },
  };
  assert.equal(resolveCastingAbilityScore(abilities, "Custom"), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test client/src/lib/spellMath.test.ts`
Expected: FAIL with `Cannot find module './spellMath'` (the file doesn't exist yet).

- [ ] **Step 3: Write `client/src/lib/spellMath.ts`**

```ts
// client/src/lib/spellMath.ts
//
// 3.5e-specific spell math, extracted so it's independently testable
// without React. 3.5e has no single flat "spell save DC" the way 5e
// does — every spell level has its own DC (design spec 2026-08-20).
// 5e's flat-DC logic stays where it already lives, in SpellSheet.tsx,
// untouched — this file only ever backs the dnd35e path.

import type { Ability } from "./characterSheetTypes";

export function spellSaveDcFor3e(spellLevel: number, abilityModifier: number): number {
  return 10 + spellLevel + abilityModifier;
}

const ABILITY_KEYS: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

export function resolveCastingAbilityScore(
  abilities: Record<Ability, { score: number; modifier: number }>,
  castingAbility: string,
): { score: number; modifier: number } | null {
  const normalized = castingAbility.trim().slice(0, 3).toLowerCase();
  const match = ABILITY_KEYS.find((k) => k === normalized);
  return match ? abilities[match] : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test client/src/lib/spellMath.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/spellMath.ts client/src/lib/spellMath.test.ts
git commit -m "Add ruleset-aware 3.5e spell DC math (per-level DC, real ability lookup)"
```

---

### Task 4: Spells tome — restyle SpellSheet.tsx and wire it into the Spells tab

**Files:**
- Modify: `client/src/components/SpellSheet.tsx`
- Modify: `client/src/pages/CharacterSheetPage.tsx`

**Interfaces:**
- Consumes: `spellSaveDcFor3e` and `resolveCastingAbilityScore` from Task 3's `client/src/lib/spellMath.ts`.
- Produces: `SpellSheet` gains two new required props — `abilities: Record<Ability, {score:number; modifier:number}>` and `ruleset: string` — replacing its previous internal fuzzy-parsing of `characterData.sections` for ability scores. Its `Props` type changes from `{ character: Character; isMyChar: boolean }` to `{ character: Character; isMyChar: boolean; abilities: Record<Ability, {score:number; modifier:number}>; ruleset: string }`.

- [ ] **Step 1: Swap the hardcoded hex palette for the shared `.dm-shell` tokens**

In `client/src/components/SpellSheet.tsx`, replace the `C` palette constant (currently lines 24-46):

```ts
const C = {
  paper:     "#f4e9c9",
  paperDark: "#e8d49e",
  ink:       "#1a0f00",
  inkMid:    "#4a2e0e",
  inkLight:  "#8a6830",
  inkFaint:  "#c4a87a",
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
  border:    "#c4a265",
  borderDark:"#9a7835",
  shadow:    "rgba(26,15,0,0.15)",
};
```

with (only the base paper/ink/border/shadow tones move to the shared tome tokens `CodexOverlay.tsx` already uses — see `client/src/styles/game-shell.css:11-31` for these variable names; the spell-level/resource accent hues — crimson/gold/purple/epic/meta/green — stay as their own distinct colors, since those are a meaningful color-coding legend independent of the surrounding page theme):

```ts
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
```

- [ ] **Step 2: Change `SpellSheet`'s props to accept real abilities + ruleset, and remove the fuzzy-matching ability lookup**

Replace the `interface Props` and the ability-derivation block (currently lines 702, 736-751):

```ts
interface Props { character: Character; isMyChar: boolean; }
```

```ts
  // Derived
  const sections: Array<{ label: string; entries: Array<{ key: string; value: string }> }> = (() => {
    try { return JSON.parse(cd).sections || []; } catch { return []; }
  })();
  const abilitySection = sections.find(s => s.entries.filter(e => {
    const k = e.key.toLowerCase().replace(/[^a-z]/g,"");
    return ["str","dex","con","int","wis","cha","strength"].some(a => k.startsWith(a));
  }).length >= 3);
  const getAbility = (abbr: string) => {
    if (!abilitySection) return 10;
    const e = abilitySection.entries.find(e => e.key.toLowerCase().replace(/[^a-z]/g,"").startsWith(abbr.toLowerCase().slice(0,3)));
    return parseInt(e?.value ?? "10") || 10;
  };
  const profBonus = character.level >= 17 ? 6 : character.level >= 13 ? 5 : character.level >= 9 ? 4 : character.level >= 5 ? 3 : 2;
  const abilityMod = Math.floor((getAbility(spellData.castingAbility) - 10) / 2);
  const spellSaveDC = spellData.spellSaveDC ?? (8 + profBonus + abilityMod);
  const spellAttackBonus = spellData.spellAttackBonus ?? (profBonus + abilityMod);
```

with:

```ts
interface Props {
  character: Character;
  isMyChar: boolean;
  abilities: Record<Ability, { score: number; modifier: number }>;
  ruleset: string;
}
```

```ts
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
```

Update the function signature (currently line 704) from:

```ts
export default function SpellSheet({ character, isMyChar }: Props) {
```

to:

```ts
export default function SpellSheet({ character, isMyChar, abilities, ruleset }: Props) {
```

Add the new imports at the top of the file, alongside the existing ones:

```ts
import type { Ability } from "@/lib/characterSheetTypes";
import { spellSaveDcFor3e, resolveCastingAbilityScore } from "@/lib/spellMath";
```

- [ ] **Step 3: Replace the flat casting-stats display with 3.5e's per-level DC where the ruleset calls for it**

Replace the "Casting stats" block (currently lines 836-856):

```tsx
          {/* ── Casting stats ── */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: C.inkFaint, fontFamily: "serif", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Ability</div>
              <select value={spellData.castingAbility} onChange={e => save({ ...spellData, castingAbility: e.target.value })}
                style={{ width: "100%", fontSize: 9, fontFamily: "serif", padding: "2px 3px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.paperDark, color: C.ink, outline: "none" }}>
                {["STR","DEX","CON","INT","WIS","CHA","Custom"].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
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
          </div>
```

with:

```tsx
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
                  Save DC (10 + spell level + {abilityMod >= 0 ? `+${abilityMod}` : abilityMod})
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
```

- [ ] **Step 4: Show the per-level DC next to each 3.5e spell-level heading**

Replace the "Standard Spells by level" heading row (currently lines 1024-1027):

```tsx
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 7.5, fontWeight: 700, fontFamily: "serif", color, textTransform: "uppercase", letterSpacing: "0.08em" }}>Level {lvl}</span>
                      {slot && <span style={{ fontSize: 7.5, color: rem > 0 ? color : C.inkFaint, fontFamily: "serif" }}>({rem}/{slot.total} slots)</span>}
                    </div>
```

with:

```tsx
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 7.5, fontWeight: 700, fontFamily: "serif", color, textTransform: "uppercase", letterSpacing: "0.08em" }}>Level {lvl}</span>
                      {slot && <span style={{ fontSize: 7.5, color: rem > 0 ? color : C.inkFaint, fontFamily: "serif" }}>({rem}/{slot.total} slots)</span>}
                      {is3e && <span style={{ fontSize: 7.5, color: C.purple, fontFamily: "serif" }}>DC {spellSaveDcFor3e(l, abilityMod)}</span>}
                    </div>
```

- [ ] **Step 5: Wrap the tome in the `.dm-shell` scope and wire it into `CharacterSheetPage.tsx`**

`SpellSheet`'s own inline styles read `.dm-shell`-scoped CSS custom properties, so its render root must live inside an element carrying the `dm-shell` class — otherwise `hsl(var(--dm-parchment))` resolves to nothing. In `client/src/pages/CharacterSheetPage.tsx`, add the stylesheet import at the top of the file (this CSS is currently only loaded by `client/src/pages/campaign.tsx`, not by this page):

```tsx
import "@/styles/game-shell.css";
```

Add the `SpellSheet` import:

```tsx
import SpellSheet from "@/components/SpellSheet";
```

Replace the Task 1 placeholder line:

```tsx
        {activeTab === "spells" && <div className="p-6 text-sm opacity-60">Spells tome coming in Task 4.</div>}
```

with:

```tsx
        {activeTab === "spells" && (
          <div className="dm-shell dm-tome p-6">
            <SpellSheet character={character as any} isMyChar={true} abilities={sheet.abilities} ruleset={sheet.ruleset} />
          </div>
        )}
```

(`isMyChar={true}` — the character sheet only ever renders the current player's own character, same assumption `SidebarCharacterSheet` and every other sheet surface already makes; there is no read-only "viewing someone else's sheet" mode in this codebase today. `character as any` because `SpellSheet`'s `Character` type comes from `@shared/schema` and has more fields than this page's local `Character` type declares — the fields `SpellSheet` actually reads, `id`, `campaignId`, `level`, `characterData`, all exist on both.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the spell-math unit tests once more (regression guard)**

Run: `node --import tsx --test client/src/lib/spellMath.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Manual verification**

Using the same local dev server and 3.5e test character from Task 2's verification step, seed `characterData.spellData` directly via a small `better-sqlite3` script (matching this session's established seeding pattern — write a `.cjs` file, run it with `node seed-script.cjs` from the project root so `node_modules` resolves, then delete the script) with at least: `castingAbility: "INT"`, one 1st-level spell slot (`slots: {1: {total: 2, used: 0}}`), and one spell entry at level 1. Open the character sheet, click the Spells tab, and confirm:

- The tome renders with the parchment/tome background (not the plain white/dark default), matching `CodexOverlay`'s visual language.
- The flat "Save DC" / "Atk Bonus" boxes are gone, replaced by the "3.5e has no single flat DC" note.
- The Level 1 spell section shows `DC 11` next to its heading (`10 + spell level 1 + INT modifier` — compute the exact expected number from whatever INT score the seeded character has, e.g. INT 12 → modifier +1 → DC 12).
- Casting the spell, toggling slots, adding a custom resource, and long/short rest all still work exactly as before (these are pre-existing `SpellSheet` behaviors — Task 4 didn't touch them, this step is a regression check).

- [ ] **Step 9: Commit**

```bash
git add client/src/components/SpellSheet.tsx client/src/pages/CharacterSheetPage.tsx
git commit -m "Resurrect SpellSheet as the Spells tome: parchment restyle, 3.5e per-level DC"
```

---

## Self-Review Notes

- **Spec coverage:** Tab infrastructure (Task 1) ✓, Equipment reference tab (Task 2) ✓, Feats relocation (Task 2) ✓, ability-score-source fix (Task 3+4) ✓, 3.5e per-level DC / no separate attack-bonus box (Task 3+4) ✓, tome visual treatment via `.dm-shell`/`.dm-tome` (Task 4) ✓, 5e path left untouched (Task 4, Step 3's `is3e` branch preserves the original flat-DC code exactly) ✓, no new DB tables (confirmed — spells still round-trip through the existing `PATCH /api/characters/:id/spell-data`) ✓, no equip/unequip actions on the sheet (`EquipmentTab` has zero action handlers) ✓.
- **Placeholder scan:** none found.
- **Type consistency:** `Item` type extended once in Task 2 Step 1 and reused identically in `EquipmentTab.tsx`; `SheetBodyProps` (defined pre-existing at `CharacterSheetPage.tsx:169-177`) is unchanged and still satisfies both `Dnd35eSheet` and `Dnd35eSheetShell`; `spellSaveDcFor3e`/`resolveCastingAbilityScore` signatures match between Task 3's creation and Task 4's consumption.
