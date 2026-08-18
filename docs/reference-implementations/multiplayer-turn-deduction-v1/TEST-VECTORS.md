# Acceptance Test Vectors - Multiplayer AI Turn Deduction

These are minimum tests for the production implementation. Adapt test syntax to the live repository.

## Migration and setup

1. Existing campaign with no policy row is migrated to `individual`, `active`.
2. Existing campaign continues deducting from the acting account after migration.
3. Migration never silently changes an existing campaign to host deduction.
4. New campaign receives a `setup_required` policy row.
5. New single-player campaign can still generate safely while only one authenticated participant exists.
6. After a second authenticated participant joins a new `setup_required` campaign, multiplayer AI generation is blocked until the host chooses a policy.
7. Guests cannot change the campaign turn-deduction policy.

## Host mode

8. Host configures `host`; policy becomes active immediately.
9. Player B acts; source resolves to host A.
10. Player C acts; source resolves to host A.
11. B and C allowances remain unchanged after their actions successfully generate DM responses.
12. Host has no available turns; B action is rejected before provider generation.
13. Host exhaustion never silently falls back to B or C.

## Individual mode

14. Host configures `individual`; revision increments.
15. Player B has not acknowledged current revision; B's AI-triggering action returns `TURN_DEDUCTION_ACK_REQUIRED` before provider generation.
16. B acknowledges; B action resolves source to B.
17. C has not acknowledged; B's acknowledgement does not authorize C.
18. C acknowledges; C action resolves source to C.
19. Host changes policy away from individual and later back to individual; revision increments and previous acknowledgements do not count.
20. OOC chat, typing indicators, dice UI events and ordinary WebSocket events consume zero turns.

## Selected-player mode

21. Host requests selected player C; current effective policy remains unchanged while request is pending.
22. Host cannot select an account that is not an authenticated campaign participant.
23. C accepts; policy changes to `selected`, source C, revision increments.
24. C's acceptance is recorded against the active revision.
25. A acts; source resolves to C.
26. B acts; source resolves to C.
27. C acts; source resolves to C.
28. C declines a pending request; current policy remains unchanged.
29. Player B cannot accept a request intended for C.
30. C revokes future use; policy becomes blocked.
31. After revocation no actor can trigger an AI generation until host selects a valid policy.
32. Revocation never silently switches to host or individual.
33. Selected C leaves the campaign or loses authenticated participation; next resolution fails safely and does not fall back.

## Reservations, idempotency and provider failures

34. AI generation receives a unique `generationId`.
35. Repeating the same reservation request with the same generationId does not consume two turns.
36. Two concurrent HTTP retries for one generationId produce one reservation.
37. Successful authoritative DM generation commits exactly one reservation.
38. Provider failure releases/refunds the reservation.
39. Timeout releases/refunds the reservation.
40. Local fallback narration after provider failure consumes zero AI turns.
41. A committed reservation cannot later be released/refunded by a duplicate late error handler.
42. A released reservation cannot later be committed by a duplicate late success handler.
43. Audit event insertion is idempotent per generationId/event type.

## Security

44. Client sends `sourceUserId: C` in action body while policy is host; server ignores it and resolves host.
45. Client sends forged selected-user acceptance for another account; rejected.
46. Guest attempts to select themselves as source without host request; rejected.
47. Anonymous/visitor identity cannot be selected as an account turn source.
48. Campaign-wide WebSocket event never broadcasts private remaining-turn counts.
49. API state does not expose another user's private subscription/allowance data.
50. Only selected account can revoke selected-player authorization.

## UI/API behavior

51. GET turn-deduction state returns `Campaign Host`, `Each Player`, selected username, setup-required, or unavailable label correctly.
52. Top indicator updates after WebSocket `turn_deduction_updated` refetch.
53. Pending selected request is visible to selected user.
54. Pending selected request does not falsely show as active to other players.
55. Individual acknowledgement modal appears before generation, not after a turn is already consumed.
56. Exhausted configured source produces a clear action-required error.
57. Campaign remains readable when AI generation is blocked for turn-source reasons.

## Current repository generation paths

58. `/api/campaigns/:id/action` uses campaign turn source rather than `req.user` for limit/deduction.
59. `/api/items/:id/use` uses campaign turn source rather than `req.user` for limit/deduction.
60. `/api/campaigns/:id/start` uses campaign turn source rather than a hardcoded request-user counter.
61. Future regenerate/retry endpoint must use the same resolver/service.
62. `checkTurnLimit(req.user)` is not left in front of a route where host/selected mode may resolve a different account.
63. `incrementTurnCount(req.user.id)` is not left as a second deduction after service commit.

## Multiplayer batching boundary

64. Current one-action/one-generation behavior under `individual` remains unambiguous.
65. A future multi-user action batch cannot enter `individual` deduction without an explicit batch attribution policy.
66. No implementation invents fractional turns or charges every batch participant one full turn without a separately approved product rule.
