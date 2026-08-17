# D&D 5e Character Core v1 — Sources

## Distributable primary rules sources

### SRD 5.1 — 2014-era fifth edition

Publisher: Wizards of the Coast
Rules profile: `dnd5e-2014`
License: Creative Commons Attribution 4.0 (also historically available under OGL 1.0a)

Use as the public/reference-code foundation for:

- core d20/proficiency mechanics
- 2014 race/class structures exposed in the SRD
- multiclassing
- combat
- skills/saves
- conditions
- spellcasting
- equipment
- advancement
- monsters/magic items only where needed by character rules

### SRD 5.2.1 — revised fifth edition

Publisher: Wizards of the Coast
Published: May 2025
Rules profile: `dnd5e-2024`
License: Creative Commons Attribution 4.0

Use as the public/reference-code foundation for:

- revised character creation
- background-driven ability adjustments
- revised species
- revised class tables
- revised subclass timing
- weapon mastery
- revised combat/glossary rules
- revised exhaustion/surprise/grappling
- revised spellcasting
- revised conditions
- revised multiclassing

Wizards explicitly states that SRD 5.1 and SRD 5.2.x contain mechanical differences. DungeonMasterOS therefore treats them as separate rules profiles.

## User-owned books

The connected Google Drive contains at least one 2014-era `Player's Handbook.pdf`. It can be used to verify the user's lawful campaign/source-pack options and to compare content omitted from the SRD.

A search did not identify an obvious owned 2024 Player's Handbook at the time this reference was created. That is not a blocker because SRD 5.2.1 supplies the revised public mechanical foundation.

## Non-SRD commercial options

The public GitHub reference should NOT become a substitute reproduction of commercial sourcebooks that are not released under the applicable SRD license.

For non-SRD options, prefer this architecture:

1. campaign/source pack records the required source id;
2. user ownership/availability is established where the product supports it;
3. private runtime rules data or licensed provider data supplies the mechanics;
4. public code contains generic rule hooks, validators and source-pack interfaces rather than copied book prose;
5. exact text can be retrieved from a user-owned source when needed rather than embedded globally.

This allows DungeonMasterOS to support full campaigns without publishing proprietary books into a public repository.

## Source hierarchy

For every mechanic:

1. selected SRD profile / official errata
2. campaign-enabled owned/licensed source
3. official publisher FAQ/clarification
4. corroborated secondary source only when the primary material is ambiguous/unavailable

Never silently resolve a 2014 gap with a 2024 rule or vice versa.

## Attribution note for future product integration

Any production use of SRD 5.1 or SRD 5.2.1 content must preserve the relevant CC-BY-4.0 attribution required by the source document.
