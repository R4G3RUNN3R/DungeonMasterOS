# Known gaps before Library of Knowledge merge

- Expand the curated executable 3.5 spell subset across the pinned readable SRD corpus; imported reference/structured spells must not mutate game state beyond encoded mechanics.
- Complete native 3.5 magic-item, potion, scroll, wand, staff, and wondrous-item mechanics beyond the current mundane SRD equipment importer.
- Build the Bestiary corpus and explicit NPC/prestige-class spellcasting state.
- Add a real cleric domain-slot/preparation resource before domain-only spells are executable; never substitute ordinary prepared slots.
- Convert remaining readable SRD feats from reference-only into executable prerequisites/modifiers, including combat feats and class-specific bonus-feat schedules.
- Replace the current simplified/5e-shaped skill substrate with a true D&D 3.5 skill/rank model before skill-dependent feats and rules become authoritative.
- Deterministically execute spell effects against combat/world targets: area membership, attack rolls, saves, spell resistance, damage/healing, conditions, movement, summons, dispels, environmental effects, and duration expiry.
- Full-site navigation label migration from legacy `Compendium` to `Compendiums`.
- Successful repository verification (`npm test`, `npm run typecheck`, `npm run build`). The execution sandbox could not clone this repo and GitHub has not started the branch-only verification workflow.
- Production smoke testing only after a deliberate deployment; this branch is not deployed.
