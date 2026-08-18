# Acceptance Test Vectors - Campaign Participation Ledger

## Qualification

1. Player joins a campaign and creates a character, takes zero meaningful actions: no Campaign History entry.
2. Player takes one meaningful action and leaves: no Campaign History entry.
3. Player takes two meaningful actions and leaves: no Campaign History entry.
4. Player sends OOC chat only: no meaningful-action increment.
5. Player leaves browser connected for hours with no activity: idle wall-clock time does not qualify campaign.
6. Player reaches 5 meaningful actions and 15 active minutes: campaign qualifies.
7. Player reaches 10 meaningful canonical actions even with less than 15 active minutes: campaign qualifies.
8. Player reaches at least 3 meaningful actions and 30 active minutes: campaign qualifies.
9. Once qualified, later leaving/removal does not remove Campaign History.
10. Campaign hosted by another account appears in qualified player's Campaign History.
11. Hosted campaign can appear in both My Campaigns and Campaign History when the host also meaningfully played.

## Idempotency / anti-gaming

12. Same canonical message/action sourceKey submitted twice increments count once.
13. HTTP retry of the same player action does not inflate meaningfulActionCount.
14. Replayed WebSocket activity pulse for same server session/minute bucket adds time once.
15. Arbitrary client-supplied pulse key is never trusted directly by production route.
16. Spam/rejected/no-op actions filtered before canonical persistence do not count.
17. Typing indicators, reconnects, subscriptions, settings changes and UI navigation do not count.
18. A future multiplayer batch counts each accepted canonical player contribution once, using unique batch-action IDs.

## Active time

19. First meaningful action starts activity/session accounting but does not invent minutes before the action.
20. Consecutive activity within the configured window adds elapsed active time.
21. A four-hour idle gap contributes at most the configured activity-window cap, not four hours.
22. Gap over the session threshold increments sessionCount.
23. Activity pulses before the player's first meaningful action do not qualify or accumulate useful play time.
24. Multiple tabs/reconnects cannot double-count the same server-issued activity bucket.

## Persistence / lifecycle

25. Removing player access changes currentAccessStatus but retains qualified historical entry.
26. Archiving campaign changes status/display but retains qualified history.
27. Campaign deletion does not crash history; minimal snapshot data remains available where product/legal policy permits.
28. Host cannot erase another player's qualified history simply by removing their character from current campaign access.
29. Character/campaign rename after qualification may refresh snapshots while accessible, but old history does not disappear if current entities later vanish.
30. A candidate participation row can exist internally without being returned by `/api/campaign-history`.

## Privacy / authorization

31. `/api/campaign-history` returns only `req.user.id` qualified entries.
32. User cannot query another player's history by supplying a userId parameter.
33. Campaign History card does not expose other participants' private account/subscription data.
34. Turn-source account and participation ledger remain independent.

## Turn-deduction interaction

35. Host-funded campaign still qualifies guest B based on B's meaningful participation.
36. Selected-player-funded campaign still qualifies all genuinely participating players independently.
37. Individual turn deduction does not make AI-turn consumption itself a meaningful-action counter; the canonical action is the evidence.
38. Failed AI provider response does not erase the player's already accepted meaningful action from participation history.
39. A failed/rejected action before canonical persistence does not count.

## Dashboard

40. Existing `/api/my-campaigns` remains owner/host campaigns only.
41. New `/api/campaign-history` returns qualified participation, including non-host campaigns.
42. Dashboard labels the sections distinctly: `My Campaigns` and `Campaign History`.
43. Drive-by joins never appear as visible Campaign History cards.
44. Account history can show approximate active play time and sessions without exposing qualification thresholds.
45. Exact qualification thresholds are not documented in player-facing UI.
