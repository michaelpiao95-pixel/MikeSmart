// One-off cleanup for duplicated pomodoro_sessions rows. Two historical bugs
// produced duplicates (clusters of rows whose started_at are within seconds):
//
//   1. delta-style   — old deployed code inserted a NEW row per incremental save;
//                      each row holds only the increment. Correct merge: SUM the
//                      cluster into one surviving row.
//   2. cumulative    — remount bug re-inserted a row holding the full cumulative
//                      session time, overlapping the earlier row. Correct merge:
//                      keep the MAX row, delete the rest.
//
// Clusters that fit neither shape are "ambiguous": merged duration is capped at
// the cluster's wall-clock span so it can never exceed physically possible time.
//
// Usage:
//   node scripts/cleanup-duplicate-pomodoro-sessions.mjs            # dry run — report only
//   node scripts/cleanup-duplicate-pomodoro-sessions.mjs --delete   # apply merges + deletes

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const THRESHOLD_SECONDS = 15;
const APPLY = process.argv.includes("--delete");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Fetch all rows (paged — PostgREST caps a single response at 1000 rows)
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("pomodoro_sessions")
    .select("id, user_id, started_at, ended_at, duration_minutes, completed")
    .order("user_id", { ascending: true })
    .order("started_at", { ascending: true })
    .range(from, from + 999);
  if (error) throw error;
  rows.push(...data);
  if (data.length < 1000) break;
}
console.log(`Fetched ${rows.length} pomodoro_sessions rows total.\n`);

// Cluster per user by started_at proximity
const clusters = [];
let current = [];
for (const row of rows) {
  const prev = current[current.length - 1];
  const sameCluster =
    prev &&
    prev.user_id === row.user_id &&
    (new Date(row.started_at) - new Date(prev.started_at)) / 1000 <= THRESHOLD_SECONDS;
  if (sameCluster) current.push(row);
  else {
    if (current.length > 1) clusters.push(current);
    current = [row];
  }
}
if (current.length > 1) clusters.push(current);

if (clusters.length === 0) {
  console.log("No duplicate clusters found. Nothing to do.");
  process.exit(0);
}

const kindCounts = { delta: 0, cumulative: 0, ambiguous: 0 };
const plan = []; // { keep, newDuration, newEndedAt, newCompleted, deleteIds, kind, changed }
let minutesBefore = 0;
let minutesAfter = 0;

for (const cluster of clusters) {
  const durs = cluster.map((r) => r.duration_minutes);
  const sum = durs.reduce((a, b) => a + b, 0);
  const max = Math.max(...durs);
  const startedMs = new Date(cluster[0].started_at).getTime();
  const lastEndMs = Math.max(...cluster.map((r) => new Date(r.ended_at ?? r.started_at).getTime()));
  const span = (lastEndMs - startedMs) / 60000; // minutes
  const anyCompleted = cluster.some((r) => r.completed);

  let kind, merged;
  if (sum <= span * 1.2 + 3) {
    kind = "delta"; // durations partition the span — they are increments
    merged = sum;
  } else if (max >= span * 0.7) {
    kind = "cumulative"; // one row already covers the whole session
    merged = max;
  } else {
    kind = "ambiguous"; // cap at what is physically possible
    merged = Math.min(sum, Math.ceil(span));
  }
  kindCounts[kind]++;
  minutesBefore += sum;
  minutesAfter += merged;

  // Survivor: prefer the completed row, then highest duration, then latest ended_at
  const sorted = [...cluster].sort(
    (a, b) =>
      Number(b.completed) - Number(a.completed) ||
      b.duration_minutes - a.duration_minutes ||
      new Date(b.ended_at ?? 0) - new Date(a.ended_at ?? 0)
  );
  const [keep, ...lose] = sorted;
  const changed =
    keep.duration_minutes !== merged ||
    new Date(keep.ended_at ?? 0).getTime() !== lastEndMs ||
    keep.completed !== anyCompleted;

  plan.push({
    keep,
    newDuration: merged,
    newEndedAt: new Date(lastEndMs).toISOString(),
    newCompleted: anyCompleted,
    deleteIds: lose.map((l) => l.id),
    kind,
    changed,
  });

  console.log(
    `[${kind.toUpperCase().padEnd(10)}] user ${keep.user_id} @ ${cluster[0].started_at} — ${cluster.length} rows, sum=${sum} max=${max} span=${span.toFixed(1)}min`
  );
  console.log(
    `  KEEP   ${keep.id}  ${keep.duration_minutes}min -> ${merged}min  completed=${keep.completed}->${anyCompleted}`
  );
  for (const l of lose) {
    console.log(`  DELETE ${l.id}  ${l.duration_minutes}min  completed=${l.completed}  ended=${l.ended_at}`);
  }
}

const toDelete = plan.flatMap((p) => p.deleteIds);
const toUpdate = plan.filter((p) => p.changed);
console.log(`\nSummary:`);
console.log(`  clusters: ${clusters.length}  (delta: ${kindCounts.delta}, cumulative: ${kindCounts.cumulative}, ambiguous: ${kindCounts.ambiguous})`);
console.log(`  rows to delete: ${toDelete.length}, surviving rows to update: ${toUpdate.length}`);
console.log(`  minutes across clusters: ${minutesBefore} raw -> ${minutesAfter} merged`);

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --delete to apply.");
  process.exit(0);
}

// Apply: update survivors first, then delete losers (order matters — if the run
// dies mid-way, no increment has been lost, only some duplicates remain)
for (const p of toUpdate) {
  const { error } = await supabase
    .from("pomodoro_sessions")
    .update({ duration_minutes: p.newDuration, ended_at: p.newEndedAt, completed: p.newCompleted })
    .eq("id", p.keep.id);
  if (error) throw error;
}
console.log(`Updated ${toUpdate.length} surviving row(s).`);

for (let i = 0; i < toDelete.length; i += 200) {
  const { error } = await supabase.from("pomodoro_sessions").delete().in("id", toDelete.slice(i, i + 200));
  if (error) throw error;
}
console.log(`Deleted ${toDelete.length} row(s). Done.`);
