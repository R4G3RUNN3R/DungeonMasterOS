# Born Into Black Nights - DungeonMasterOS QA

## Current verdict
`QA COMPLETE AT STORY/CANON LEVEL - MACHINE SCHEMA VALIDATION PENDING`

The source-derived campaign structure is sufficiently complete to run without inventing a hidden villain, room, clue or resolution condition. Native ruleset and licence are verified from the creator page. The detailed adventure text was cross-checked through an indexed copy.

A final `APPROVED` promotion is intentionally withheld until automated validation of `dmos-template.json` against `campaign-template-v2.schema.json` can be run. The local code-execution container returned infrastructure errors during this pass, so no false validation claim is being made.

## Source / rights checks
- Author/title/native ruleset verified from creator primary page: PASS.
- Text CC BY-SA 4.0 verified from primary creator page and adventure credit text: PASS.
- Mirror used for detailed extraction is not treated as licence authority: PASS.
- Separate art/map rights are not silently folded into text licence: PASS.

## Ruleset checks
- Native ruleset explicitly `Cairn`: PASS.
- No invented D&D level range: PASS.
- Generic fantasy conversion is marked converted rather than native: PASS.

## Campaign-state adversarial tests

### Player ignores Oskar
PASS. Anet, Pyke, Osian, Kyran and Zahra's sleepwalking all provide alternate routes into the problem.

### Player kills Kyran immediately
PASS. The tomb and haunting still exist. The ring may be recovered from him; even without his confession, Osian/Pyke/Zahra provide routes toward the truth.

### Player never gets Bertram's ring
PASS. The source says restoring the ring is desirable if possible, but the central rest condition is Bertram's return to the sarcophagus and peaceful funerary treatment. DMOS does not convert the ring into an impossible hard gate.

### Player kills every undead and leaves
PASS. This is represented as temporary failure/unfinished resolution; undead can re-form and nightmares persist.

### Player incinerates/destroys Bertram
PASS. This becomes the delayed ghost-return/possession failure state rather than a victory.

### Player tries to talk to Bertram during the Draugr confrontation
PASS. Bertram's goal remains rest, but his source state is incoherent/moaning; the AI may not manufacture a lucid exposition speech simply to rescue pacing.

### Player follows Zahra into the woods
PASS. This is a source-backed alternate route toward the ruins.

### Player enters the tomb from an unexpected tactical plan
PASS. Free text is allowed, but room topology/door state remains authoritative. The AI cannot teleport or invent a secret entrance unless normal adjudication of source geometry supports it.

### Player retreats after discovering the tomb
PASS. Town crisis remains active; investigation can resume later.

### Player remains in Bertram's Grove after success
PASS. The source explicitly supports using the settlement as an ongoing campaign base and allows Warden expansion of minor townspeople/details.

## Required scene-choice behaviour
- Investigation scenes expose 3-4 sensible options: PASS.
- Free-text action remains available: PASS.
- Suggested choices are not mandatory rails: PASS.
- Hidden truth is preserved across alternate clue routes: PASS.

## Remaining blocker
Run machine JSON/schema validation when code execution is available. If validation passes, promote `status` to `approved`, update the completion dashboard and add the approval to both public update feeds.
