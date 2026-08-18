// In-process per-campaign serialization. This is what makes turn-order
// enforcement actually hold under real concurrent HTTP requests, not just in
// the single-player happy path — without it, two players submitting actions
// at the same moment could both read the same "current turn" state and both
// proceed. Correct for DMOS's current single-process (systemd) deployment;
// would need to become a DB-level lock if ever scaled to multiple instances.

const queues = new Map<number, Promise<unknown>>();

export function withCampaignLock<T>(campaignId: number, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(campaignId) ?? Promise.resolve();

  const run = previous
    .catch(() => {}) // a prior call's rejection must not propagate into or block this one
    .then(fn);

  // Store a settled-either-way marker so the NEXT call queues behind this one
  // regardless of whether `run` itself resolves or rejects.
  const marker = run.catch(() => {});
  queues.set(campaignId, marker);

  return run;
}
