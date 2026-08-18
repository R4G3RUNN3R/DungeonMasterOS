// client/src/components/game/CampaignGameShell.tsx
//
// Phase 1 orchestrator for the immersive live-play shell (design spec §3,
// §17-18). campaign.tsx remains the data/orchestration boundary — this
// component receives display data and callbacks as props and is
// responsible only for layout/presentation. No new queries, mutations, or
// WebSocket handling live here; everything continues to flow through the
// existing contracts campaign.tsx already owns.

import { useState, type CSSProperties, type RefObject } from "react";
import { Loader2, Sparkles, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import CampaignGameHeader from "./CampaignGameHeader";
import CharacterHud from "./CharacterHud";
import StoryChronicle from "./StoryChronicle";
import ContextPanel from "./ContextPanel";
import ActionComposer from "./ActionComposer";
import ContextActionDeck from "./ContextActionDeck";
import MobileGameChrome from "./MobileGameChrome";
import SceneBackdrop from "./SceneBackdrop";
import CharacterProfileDialog from "./CharacterProfileDialog";
import InventoryOverlay from "./InventoryOverlay";
import CodexOverlay from "./CodexOverlay";

import { getRulesAdapter } from "@/lib/rulesAdapters";
import { useGameLayoutPreferences, LAYOUT_PRESETS, type LayoutPreset } from "@/lib/gameLayoutPreferences";
import { openCharacterSheetPopup } from "@/lib/openCharacterSheetPopup";
import { resolveSceneAsset } from "@shared/scene-resolver";
import type { WorldState } from "@shared/world-state";
import type { ActiveEffectDisplay } from "./ActiveConditions";
import type { GrantedItemDisplay } from "./LootFlash";
import type { EncounterState } from "@shared/combat";
import { activeParticipants, currentTurnParticipant } from "@shared/combat";

import ShopPanel from "@/components/ShopPanel";

type Message = {
  id: number;
  sender: string;
  senderType: "dm" | "player" | "system";
  content: string;
  messageType: string;
};

type Character = {
  id: number;
  name: string;
  race: string;
  charClass: string;
  traits: string;
  backstory: string;
  hp: number;
  maxHp: number;
  speed: number;
  attacksPerRound: number;
  characterData: string;
};

type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
  weight: number;
  carried: boolean;
};

type CampaignCurrency = { id: number; code: string; name: string; symbol: string; isPrimary: boolean };
type CurrencyBalance = { currencyCode: string; amount: number };
type ShopItem = { id: number; name: string; priceAmount: number; priceCurrencyCode: string; stock: number };
type ActiveShop = { merchantName: string; merchantDescription: string; currencyCode: string; title: string };

type Props = {
  campaignId: number;
  campaignName: string;
  worldType?: string | null;
  worldState: WorldState;
  character: Character;
  party: Array<{ id: number; name: string; race: string; charClass: string }>;
  messages: Message[];
  items: Item[];
  onToggleCarried: (itemId: number, carried: boolean) => void;
  effects: ActiveEffectDisplay[];
  recentLoot: GrantedItemDisplay | null;
  campaignCurrencies: CampaignCurrency[];
  balances: CurrencyBalance[];
  shop: { shop: ActiveShop; items: ShopItem[] } | null;
  connected: boolean;
  dmThinking: boolean;

  actionInput: string;
  onActionInputChange: (value: string) => void;
  onSubmitAction: () => void;
  actionPending: boolean;

  showBeginAdventure: boolean;
  onBeginAdventure: () => void;
  beginAdventurePending: boolean;
  beginAdventureDisabled: boolean;

  onBuy: (shopItemId: number, quantity: number) => void;
  buyPending: boolean;

  encounter: EncounterState;
  onAttack: (targetCombatantId: number) => void;
  onFlee: () => void;
  attackPending: boolean;

  onBack: () => void;
  scrollRef: RefObject<HTMLDivElement>;
};

const PRESET_LABELS: Record<LayoutPreset, string> = {
  wide: "Wide",
  reading: "Reading",
  cinematic: "Cinematic",
};

function currencyDisplayList(campaignCurrencies: CampaignCurrency[], balances: CurrencyBalance[]) {
  // Prefer the D&D-flavoured copper/silver/gold/platinum set the spec calls
  // out (§4.5) when the campaign actually defines them; otherwise show
  // whatever currencies the campaign uses, in whatever order they exist.
  return balances
    .map((balance) => {
      const def = campaignCurrencies.find((c) => c.code === balance.currencyCode);
      return { code: balance.currencyCode, label: def?.name ?? balance.currencyCode, amount: balance.amount, isPrimary: def?.isPrimary ?? false };
    })
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.code.localeCompare(b.code));
}

export default function CampaignGameShell({
  campaignId,
  campaignName,
  worldType,
  worldState,
  character,
  party,
  messages,
  items,
  onToggleCarried,
  effects,
  recentLoot,
  campaignCurrencies,
  balances,
  shop,
  connected,
  dmThinking,
  actionInput,
  onActionInputChange,
  onSubmitAction,
  actionPending,
  showBeginAdventure,
  onBeginAdventure,
  beginAdventurePending,
  beginAdventureDisabled,
  onBuy,
  buyPending,
  encounter,
  onAttack,
  onFlee,
  attackPending,
  onBack,
  scrollRef,
}: Props) {
  const { preferences, setPreset } = useGameLayoutPreferences();
  const [profileOpen, setProfileOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [shopExpanded, setShopExpanded] = useState(false);

  const hud = getRulesAdapter().buildCharacterHud(character, items);
  const currencies = currencyDisplayList(campaignCurrencies, balances);

  const inCombat = encounter.encounter?.status === "active";
  const contextLabel = inCombat ? "Combat" : shop ? "Merchant" : recentLoot ? "Loot" : "Exploration";
  const deck = inCombat ? "combat" : shop ? "merchant" : "exploration";

  const combatTargets = inCombat ? activeParticipants(encounter.participants).filter((p) => p.type === "npc") : [];
  const myTurn = (() => {
    if (!inCombat) return false;
    const current = currentTurnParticipant(encounter);
    return !!current && current.type === "character" && current.characterId === character.id;
  })();

  // No location/scene-classification signal exists yet (that's later
  // context-expansion work), so this always resolves to the fallback
  // gradient today — that's correct, not a placeholder bug. The resolver
  // is wired now so a real environment signal can flow straight through
  // once one exists, without touching this component again.
  const scene = resolveSceneAsset({ environmentKey: null });

  const insertPrefix = (prefix: string) => {
    onActionInputChange(actionInput ? `${actionInput} ${prefix}` : prefix);
  };

  const characterHudNode = (
    <CharacterHud
      hud={hud}
      currencies={currencies}
      onOpenPortrait={() => setProfileOpen(true)}
      onOpenSheet={() => openCharacterSheetPopup(campaignId)}
      onOpenInventory={() => setInventoryOpen(true)}
      onOpenCodex={() => setCodexOpen(true)}
    />
  );

  const contextPanelNode = (
    <ContextPanel
      worldType={worldType}
      worldState={worldState}
      party={party}
      effects={effects}
      recentLoot={recentLoot}
      activeShop={shop}
      onViewShop={() => setShopExpanded((v) => !v)}
      shopExpanded={shopExpanded}
      encounter={encounter}
    />
  );

  return (
    <div className="dm-shell relative h-screen overflow-hidden flex flex-col">
      <SceneBackdrop
        imageUrl={scene.asset?.localAssetPath ?? null}
        dimPercent={scene.asset?.suitability.suggestedDim}
        vignette={scene.asset?.suitability.suggestedVignette}
        blurPx={scene.asset?.suitability.suggestedBlurPx}
      />

      <CampaignGameHeader campaignName={campaignName} connected={connected} onBack={onBack} />

      {/*
        Single column below `lg` (the two asides are `hidden` there anyway —
        MobileGameChrome's bottom sheets take over). At `lg` and above, the
        three-column grid track widths come from CSS custom properties set
        below, driven by the player's saved layout preference — this has to
        stay pure-CSS (not a JS window-width check) so it responds correctly
        to live window resizing without a resize listener.
      */}
      <div
        className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[var(--dm-hud-w)_1fr_var(--dm-context-w)]"
        style={
          {
            "--dm-hud-w": `minmax(220px, ${preferences.hudWidthPct}%)`,
            "--dm-context-w": `minmax(240px, ${preferences.contextWidthPct}%)`,
          } as CSSProperties
        }
      >
        {/* Desktop Character HUD */}
        <aside className="hidden lg:block min-h-0 overflow-hidden">{characterHudNode}</aside>

        {/* Story + composer */}
        <main className="min-h-0 flex flex-col min-w-0">
          <StoryChronicle ref={scrollRef} messages={messages} dmThinking={dmThinking} />

          <div className="dm-leather border-t shrink-0">
            {showBeginAdventure ? (
              <div className="p-3">
                <Button onClick={onBeginAdventure} disabled={beginAdventureDisabled} className="w-full h-11">
                  {beginAdventurePending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Beginning...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Begin Adventure
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                <ContextActionDeck
                  deck={deck}
                  onInsertPrefix={insertPrefix}
                  onOpenInventory={() => setInventoryOpen(true)}
                  onBuy={() => setShopExpanded(true)}
                  onSell={() => setShopExpanded(true)}
                  onLeaveMerchant={() => setShopExpanded(false)}
                  combatTargets={combatTargets}
                  onAttack={onAttack}
                  onFlee={onFlee}
                  myTurn={myTurn}
                  attackPending={attackPending}
                />
                <ActionComposer
                  value={actionInput}
                  onChange={onActionInputChange}
                  onSubmit={onSubmitAction}
                  pending={actionPending}
                  playingAs={character.name}
                  connected={connected}
                />
              </>
            )}
          </div>
        </main>

        {/* Desktop Context Panel */}
        <aside className="hidden lg:block min-h-0 overflow-hidden">{contextPanelNode}</aside>
      </div>

      {/* Layout preset switcher — the visible tip of the player-layout-
          preference iceberg (spec §7); width proportions persist via
          useGameLayoutPreferences. */}
      <div className="hidden lg:flex absolute bottom-3 right-3 z-20 gap-1 dm-surface rounded-md p-1 border">
        {(Object.keys(PRESET_LABELS) as LayoutPreset[]).map((key) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`text-[10px] px-2 py-1 rounded uppercase tracking-wide transition-colors ${
              preferences.preset === key
                ? "dm-leather dm-amber-text"
                : "text-[hsl(var(--dm-text-faint))] hover:text-[hsl(var(--dm-text-muted))]"
            }`}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>

      <MobileGameChrome characterHud={characterHudNode} contextPanel={contextPanelNode} contextLabel={contextLabel} />

      <CharacterProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        hud={hud}
        traits={character.traits}
        backstory={character.backstory}
      />
      <InventoryOverlay
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        items={items}
        carryWeight={hud.carryWeight}
        onToggleCarried={onToggleCarried}
      />
      <CodexOverlay
        open={codexOpen}
        onOpenChange={setCodexOpen}
        traits={character.traits}
        backstory={character.backstory}
        characterData={character.characterData}
      />

      {shop && (
        <Dialog open={shopExpanded} onOpenChange={setShopExpanded}>
          <DialogContent
            className="dm-shell dm-surface border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] max-w-lg max-h-[85vh] overflow-y-auto p-0"
            style={{ boxShadow: "inset 0 0 0 1px hsl(var(--dm-bronze) / 0.35)" }}
          >
            <DialogHeader className="px-4 pt-4 pb-3 dm-ledger-header">
              <DialogTitle className="dm-heading flex items-center gap-2">
                <Store className="w-4 h-4 dm-amber-text" />
                {shop.shop.title || shop.shop.merchantName}
              </DialogTitle>
            </DialogHeader>
            <ShopPanel
              shop={shop.shop as any}
              items={shop.items as any}
              balances={balances as any}
              currencies={campaignCurrencies as any}
              buying={buyPending}
              onBuy={onBuy}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
