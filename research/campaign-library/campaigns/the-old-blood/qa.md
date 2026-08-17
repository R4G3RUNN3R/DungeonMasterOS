# The Old Blood - DungeonMasterOS QA

## Current verdict
`APPROVED BY CENTRAL GATE - FINAL EXACT-HEAD CI CONFIRMATION REQUIRED`

Native ruleset: **Shadowdark RPG**.
Progression: **levels 1-2**.
Creator-supported compatibility: OSR-style systems, with system mechanics handled by explicit adapters.

The final source audit resolved the prior completeness blockers. Exact keyed source registers now exist for all Sewer sectors, all three Catacomb levels, both Ruins floors, the 16-room Secret Dungeon and Flooded Shrine. The full 20-name resident table is captured separately, including four residents omitted from the earlier register.

## Source / rights QA
- Creator identity/current release: PASS.
- Shadowdark levels 1-2: PASS.
- Original campaign writing/layout/design CC0: PASS.
- Shadowdark mechanics kept outside CC0 campaign-data claims: PASS.
- Current creator page-order update acknowledged: PASS.

## Source completeness QA
- Six Sewer sectors: PASS.
- Catacombs levels 1-3: PASS.
- Ruins floors 1-2: PASS.
- Secret Dungeon rooms 1-16: PASS.
- Flooded Corridor / Flooded Shrine: PASS.
- Blood Rite location/procedure/consequence: PASS.
- Victor / weakened Edric / restored Edric / Forgotten native-stat references verified in source: PASS, with exact mechanics delegated to authorised Shadowdark adapter.
- Whispering Blade source dependencies verified: PASS.
- Full named resident table: PASS.

## Core canon QA
- Victor remains initial killer: PASS.
- Edric remains dormant until Crypt breach: PASS.
- Flooded Shrine remains separate deeper cause: PASS.
- Defeating Victor/Edric does not magically restore Brannam: PASS.
- Blood Rite remains a recurring-sacrifice outcome rather than a consequence-free victory: PASS.
- Rumours never overwrite truth flags: PASS.

## Adversarial player simulations
The existing story graph has been reviewed against the following behaviours and remains valid:
- Kill Victor immediately: PASS. Edric stays dormant unless separately awakened; evidence/deeper Shrine remain.
- Arrest Victor before a chase: PASS. No mandatory chase.
- Enter Sewers immediately: PASS. Players can sequence-break and even awaken Edric early.
- Accuse or kill Father Brenwick: PASS. Social consequences occur without rewriting killer identity.
- Burn Victor's shop: PASS. Clues may be destroyed, but alternate evidence paths remain.
- Leave Brannam: PASS. Active threats/clocks continue.
- Wake Edric then abandon the city: PASS. Edric can restore and become regional threat.
- Kill Edric and leave: PASS. Shrine and civic decay remain unresolved.
- Destroy Shrine before waking Edric: PASS. Source causality updates without inventing an instant cure for Victor.
- Perform Blood Rite: PASS. Annual sacrifice and alien consequences remain mandatory.
- Ignore every suggested action: PASS. Free-text traversal and investigation remain valid.

## AI-choice QA
- 3-5 contextual suggested actions where useful: PASS.
- Free text always valid: PASS.
- No hidden killer/spoiler in suggestions before discovery: PASS.
- State changes, not narration alone, control consequences: PASS.

## Machine validation
- Pre-approval v2 migration passed Campaign Library CI's `Validate campaign library` step.
- The approved template is now committed with `status: approved`.
- A fresh exact-head CI run after approval/log synchronization is still required before the approval is considered mechanically locked for release.

## Final release boundary
DungeonMasterOS may ship the CC0 campaign fiction/structure with provenance. Exact Shadowdark mechanics/stat blocks must come from an authorised rules integration; they are not reclassified as CC0 by this campaign.

Central approval evidence: `approval-review.md`, `approval-manifest.json`, `source-verification.md`, `keyed-location-register.json`, `named-npc-register.json`.