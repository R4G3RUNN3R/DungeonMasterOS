# Born Into Black Nights - DungeonMasterOS QA

## Final verdict
`APPROVED`

The source-derived campaign structure is sufficiently complete to run without inventing a hidden villain, room, clue or resolution condition. Native ruleset and licence are verified from the creator page, the detailed adventure text was cross-checked through an indexed copy, and the v2 campaign template passed branch-level machine validation.

## Source / rights checks
- Author/title/native ruleset verified from creator primary page: PASS.
- Text CC BY-SA 4.0 verified from primary creator page and adventure credit text: PASS.
- Mirror used for detailed extraction is not treated as licence authority: PASS.
- Separate art/map rights are not silently folded into text licence: PASS.
- Attribution/ShareAlike release obligation recorded: PASS.

## Ruleset checks
- Native ruleset explicitly `Cairn`: PASS.
- No invented D&D level range: PASS.
- Generic fantasy conversion is marked converted rather than native: PASS.

## Machine validation
- GitHub Actions workflow: `Campaign Library CI`.
- Validated head: `f82e0bf16d4d9fefdbc7573fa4f3a5188757c1e5`.
- Validation job: PASS.
- The workflow parsed campaign-library JSON and schema-validated all v2 templates present at that head.

## Campaign-state adversarial tests

### Player ignores Oskar
PASS. Anet, Pyke, Osian, Kyran and Zahra's sleepwalking provide alternate routes into the problem.

### Player kills Kyran immediately
PASS. The tomb and haunting still exist. The ring may be recovered from him; even without his confession, Osian/Pyke/Zahra provide routes toward the truth.

### Player never gets Bertram's ring
PASS. Restoring the ring is desirable if possible, but the core rest condition remains Bertram's return to the sarcophagus and peaceful funerary treatment. DMOS does not convert the ring into an impossible hard gate.

### Player kills every undead and leaves
PASS. This is temporary failure/unfinished resolution; undead can re-form and nightmares persist.

### Player destroys Bertram
PASS. This becomes the delayed ghost-return/possession failure state rather than victory.

### Player tries to talk to Bertram during the Draugr confrontation
PASS. Bertram's goal remains rest, but the AI may not manufacture a lucid exposition speech from his incoherent source state merely to rescue pacing.

### Player follows Zahra into the woods
PASS. This is a source-backed alternate route toward the ruins.

### Player enters the tomb with an unexpected tactical plan
PASS. Free text is allowed while room topology/door state remains authoritative.

### Player retreats
PASS. The town crisis remains active and investigation can resume later.

### Player remains in Bertram's Grove after success
PASS. The source explicitly supports using the settlement as an ongoing campaign base and allows Warden expansion of minor townspeople/details.

## Choice/free-text checks
- Investigation scenes expose 3-4 sensible options: PASS.
- Free-text action remains available: PASS.
- Suggested choices are not mandatory rails: PASS.
- Hidden truth is preserved across alternate clue routes: PASS.

## Approval conclusion
Source, licence, native ruleset, campaign canon, topology, NPC knowledge, encounter state, choices/free text, alternate failures, endings and machine schema validation are sufficient for the built-in campaign library.
