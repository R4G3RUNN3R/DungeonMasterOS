# The Old Blood approval verification marker

Date: 2026-08-17

This marker intentionally triggers Campaign Library CI after all central approval, dashboard, public-update, research-log and changelog changes for `The Old Blood` have been committed.

Expected approved state:
- campaign: The Old Blood
- native ruleset: Shadowdark RPG
- progression: levels 1-2
- `dmos-template.json`: v2 schema, status `approved`
- central approval review: present
- source verification register: present
- named NPC register: present
- keyed location register: present
- public approved count: 4

Approval is mechanically locked only if Campaign Library CI succeeds on the commit containing this marker.