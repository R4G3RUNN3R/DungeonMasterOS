// Standalone verification for the getMessagesByCampaign ordering fix.
// Runs against a throwaway in-memory DB — never touches production data.
import Database from "better-sqlite3";

const db = new Database(":memory:");
db.exec(`
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL
  );
`);

const TOTAL = 250;
const insert = db.prepare("INSERT INTO messages (campaign_id) VALUES (1)");
for (let i = 0; i < TOTAL; i++) insert.run();

function oldBuggyQuery(limit) {
  return db
    .prepare("SELECT id FROM messages WHERE campaign_id = 1 ORDER BY id LIMIT ?")
    .all(limit)
    .map((r) => r.id);
}

function newFixedQuery(limit) {
  return db
    .prepare("SELECT id FROM messages WHERE campaign_id = 1 ORDER BY id DESC LIMIT ?")
    .all(limit)
    .map((r) => r.id)
    .reverse();
}

const limit = 200;
const oldResult = oldBuggyQuery(limit);
const newResult = newFixedQuery(limit);

console.log(`Total messages seeded: ${TOTAL}`);
console.log(`OLD (buggy) query -> first id: ${oldResult[0]}, last id: ${oldResult.at(-1)}, count: ${oldResult.length}`);
console.log(`NEW (fixed) query -> first id: ${newResult[0]}, last id: ${newResult.at(-1)}, count: ${newResult.length}`);

const expectedFirst = TOTAL - limit + 1; // 51
const expectedLast = TOTAL; // 250

const checks = [
  ["old query returns OLDEST messages (demonstrates the bug)", oldResult[0] === 1 && oldResult.at(-1) === limit],
  ["new query returns the MOST RECENT messages", newResult[0] === expectedFirst && newResult.at(-1) === expectedLast],
  ["new query result is in ascending chronological order", newResult.every((id, i) => i === 0 || id > newResult[i - 1])],
  ["new query returns exactly `limit` messages", newResult.length === limit],
];

let allPassed = true;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${label}`);
  if (!passed) allPassed = false;
}

// Also verify under-limit behavior is unaffected (e.g. a fresh campaign with 5 messages)
db.exec("DELETE FROM messages; INSERT INTO messages (campaign_id) SELECT 2 FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5);");
const underLimitOld = db.prepare("SELECT id FROM messages WHERE campaign_id = 2 ORDER BY id LIMIT 200").all().map(r => r.id);
const underLimitNew = db.prepare("SELECT id FROM messages WHERE campaign_id = 2 ORDER BY id DESC LIMIT 200").all().map(r => r.id).reverse();
const underLimitMatch = JSON.stringify(underLimitOld) === JSON.stringify(underLimitNew);
console.log(`${underLimitMatch ? "PASS" : "FAIL"}: under-limit campaigns (fewer than 200 messages) behave identically to before`);
if (!underLimitMatch) allPassed = false;

db.close();

if (!allPassed) {
  console.error("\nVERIFICATION FAILED");
  process.exit(1);
}
console.log("\nAll checks passed.");
