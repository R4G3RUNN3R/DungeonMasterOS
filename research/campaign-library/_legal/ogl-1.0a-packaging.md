# Open Game License 1.0a - DungeonMasterOS Campaign Packaging Notes

Status: research/implementation guidance, not legal advice.

## Why this file exists

DungeonMasterOS is now researching adventures that explicitly designate their story/adventure text as Open Game Content under the Open Game License v1.0a. This is different from merely using an OGL rules engine. Each campaign must record exactly what the source designates as Open Game Content and what remains Product Identity.

## Operational requirements captured from the licence

When DungeonMasterOS copies, modifies or distributes Open Game Content under OGL v1.0a, release packaging must account for at least the following licence requirements:

1. **Include the OGL v1.0a text** with every distributed copy of Open Game Content.
2. **Clearly identify the portions distributed as Open Game Content.** Do not leave the designation ambiguous.
3. **Preserve/update the COPYRIGHT NOTICE.** Include the exact Copyright Notice entries required by the source Open Game Content and add the title/date/copyright-holder information required for original Open Game Content DungeonMasterOS distributes.
4. **Do not apply incompatible additional terms to the Open Game Content.** OGL content must remain governed by the OGL terms applicable to it.
5. **Do not use Product Identity without permission.** A source can designate trademarks, product names, logos, trade dress, artwork and other material as Product Identity even when the adventure text is open.
6. **Do not use contributor names to market/advertise the Open Game Content without written permission.** Contributor credits may appear where the licence/attribution requires them, but promotional endorsement is a separate issue.
7. **Keep artwork rights separate.** If the source says text is OGC but art is not, DungeonMasterOS may transform the text while excluding/replacing protected artwork.
8. **Maps/floorplans are source-specific.** Some Basic Fantasy documents expressly designate maps/floorplans as OGC; others must be checked individually. Never infer map rights from text rights.

## Basic Fantasy-specific Product Identity

The Basic Fantasy rules designate the product/product-line names, logos and specified visual branding as Product Identity while making the rules text/maps/floorplans Open Game Content. Its separate Product Identity License permits certain compatibility wording and logo use if its conditions are satisfied.

For DungeonMasterOS campaign metadata:

- Research files may identify the **native source ruleset** accurately for provenance.
- Public release/marketing should use only compatibility wording permitted by the applicable Product Identity License, or use a neutral rules-family description if the release does not rely on that permission.
- Do not use Basic Fantasy logos/artwork simply because an adventure's text is OGC.

## Adventure Anthology One

The anthology's licence section designates the entire anthology text, excluding the licence itself, as Open Game Content. Individual adventure releases such as `Merilla's Magic Tower` go further and explicitly designate their entire text and included maps/floorplans as OGC while reserving non-map artwork and product branding.

This creates a high-value DMOS research pool because story premises, named characters, locations, monsters/items created in the adventures, room text, outcomes and other text are openly licensed **when they fall inside the source's explicit OGC designation**.

## Required per-campaign legal record

Every OGL campaign dossier should include:

- source title/version;
- native ruleset;
- source URL;
- exact OGC designation scope;
- Product Identity exclusions;
- maps/floorplan status;
- artwork status;
- required source Copyright Notice entries;
- whether compatibility branding will be used;
- DMOS release disposition;
- exact OGL package/file that must accompany the shipped derivative.

## Current verified source examples

### Merilla's Magic Tower
- Full text: OGC.
- Included maps/floorplans: OGC.
- Other artwork: excluded from OGC.
- Product/product-line branding and visual marks: Product Identity.
- Source Copyright Notice includes `Merilla's Magic Tower Copyright 2007 Rob Pinnell` plus upstream OGL/SRD/Basic Fantasy notices.

### Adventure Anthology One
- Entire anthology text except the OGL text itself: OGC.
- Artwork: excluded unless separately designated.
- Product/product-line branding/logos: Product Identity.

## Release gate

No OGL-derived campaign may move from research to production integration until its exact OGL designation and required Copyright Notice are stored alongside the template. `APPROVED` in campaign QA means story/template QA only unless the release-package legal checklist also says `ready`.
