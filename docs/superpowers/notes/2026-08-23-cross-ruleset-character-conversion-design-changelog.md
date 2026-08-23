# 2026-08-23 - Cross-ruleset character conversion design

- **Area:** Character conversion, item translation, ruleset isolation, AI Shop, multiplayer approval.
- **Change:** Added an architecture-only design for non-destructive cross-ruleset character versions, versioned translation profiles, semantic item conversion, AI fallback, destination-scoped Conversion Credit, and Cross-Version Reintegration.
- **Player/DM impact:** No live behavior changes. The design preserves Origin Versions, prevents silent item loss, keeps rulesets isolated, and requires DM/ST approval for mechanical reintegration into active multiplayer campaigns.
- **Implementation status:** Not implemented. Must be revalidated against the final ruleset/canonical-library architecture before any production code is written.
