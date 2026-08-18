// client/src/lib/openCharacterSheetPopup.ts
//
// Extracted from the pre-redesign `CampaignCharacterSheetLauncher` in
// App.tsx so both that entry point and the new Character HUD's "Sheet"
// button open the exact same authoritative character-sheet popup, rather
// than the redesign accidentally growing a second, divergent mechanism.
export function openCharacterSheetPopup(campaignId: number | string): void {
  const popup = window.open(
    `/#/character-sheet/${campaignId}`,
    `dmos-character-sheet-${campaignId}`,
    "popup=yes,width=1500,height=950,resizable=yes,scrollbars=yes",
  );
  popup?.focus();
}
