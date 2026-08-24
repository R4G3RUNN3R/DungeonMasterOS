import { PUBLIC_UPDATES } from "@shared/public-updates";
import { storage } from "./storage";

export function syncBundledPublicUpdates(): { inserted: number; totalBundled: number } {
  const existing = new Set(
    storage.getUpdates().map((entry) => `${entry.date}\u0000${entry.title}`),
  );

  let inserted = 0;
  for (const entry of PUBLIC_UPDATES) {
    const key = `${entry.date}\u0000${entry.title}`;
    if (existing.has(key)) continue;

    storage.createUpdate({
      date: entry.date,
      title: entry.title,
      description: entry.description,
    });
    existing.add(key);
    inserted += 1;
  }

  return { inserted, totalBundled: PUBLIC_UPDATES.length };
}
