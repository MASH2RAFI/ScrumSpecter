#!/usr/bin/env node
// How far away is the database from a deployment? Samples /api/health (its latencyMs is one database
// round trip, measured inside the server) and the whole request time, then prints medians.
//   node scripts/perf/health-latency.mjs https://<deployment>.vercel.app [samples, default 20]
// Compare two deployments (e.g. a preview in another region against production) with the same count.
// Reads only the public health endpoint.
const [base, count = "20"] = process.argv.slice(2);
if (!base) { console.error("usage: health-latency.mjs <base url> [samples]"); process.exit(1); }

const inside = [], total = [];
for (let i = 0; i < Number(count); i++) {
    const start = Date.now();
    const response = await fetch(`${base.replace(/\/$/, "")}/api/health`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    total.push(Date.now() - start);
    if (body.latencyMs !== undefined) inside.push(body.latencyMs);
    await new Promise((resolve) => setTimeout(resolve, 400));
}
const median = (list) => list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : NaN;
const p90 = (list) => list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length * 0.9)] : NaN;
console.log(`${base}  ${count} samples`);
console.log(`  database round trip: median ${median(inside)} ms · p90 ${p90(inside)} ms (${inside.length} answered)`);
console.log(`  whole request:       median ${median(total)} ms · p90 ${p90(total)} ms`);
