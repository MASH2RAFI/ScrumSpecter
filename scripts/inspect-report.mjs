#!/usr/bin/env node
// Builds the visual inspector page from e2e/inspect.spec.ts's captures: for each scene, light and
// dark rows, each with the desktop and phone screenshots side by side, grouped by area.
// Usage: INSPECT=<folder> npx playwright test e2e/inspect.spec.ts && node scripts/inspect-report.mjs <folder>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
    console.error("Usage: node scripts/inspect-report.mjs <folder with manifest.json>");
    process.exit(1);
}
const { taken, scenes } = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const when = new Date(taken).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
const groups = [...new Set(scenes.map((scene) => scene.group ?? "Screens"))];
const shot = (scene, theme, view) => scene.shots.find((s) => s.theme === theme && s.view === view)?.file;

const row = (scene, theme) => `
      <div class="pair">
        <figure class="desktop"><figcaption>${theme === "dark" ? "Dark" : "Light"} · desktop 1440 × 900</figcaption><img src="${esc(shot(scene, theme, "desktop"))}" alt="${esc(scene.title)}, ${theme}, desktop" loading="lazy"></figure>
        <figure class="mobile"><figcaption>${theme === "dark" ? "Dark" : "Light"} · phone 390 × 844</figcaption><img src="${esc(shot(scene, theme, "mobile"))}" alt="${esc(scene.title)}, ${theme}, phone" loading="lazy"></figure>
      </div>`;

let n = 0;
const sections = groups.map((group) => `
  <h2 class="group" id="g-${esc(group.toLowerCase().replace(/\W+/g, "-"))}">${esc(group)}</h2>
  ${scenes.filter((scene) => (scene.group ?? "Screens") === group).map((scene) => `
    <section id="${esc(scene.id)}">
      <h3><span class="num">${++n}</span>${esc(scene.title)}</h3>
      <p class="note">${esc(scene.note)}</p>
      ${row(scene, "light")}
      ${row(scene, "dark")}
    </section>`).join("")}`).join("");

writeFileSync(join(dir, "index.html"), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ScrumSpecter Inspector</title>
<style>
  :root { --bg: #f4f6f5; --card: #ffffff; --text: #17201b; --muted: #5c6b63; --line: #d9e1dc; --accent: #1b6e45; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0c110e; --card: #151c18; --text: #e8eeea; --muted: #9aa8a0; --line: #2b3530; --accent: #4cc38a; } }
  :root[data-theme="dark"] { --bg: #0c110e; --card: #151c18; --text: #e8eeea; --muted: #9aa8a0; --line: #2b3530; --accent: #4cc38a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { padding: 28px 16px 8px; max-width: 1400px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  .meta { color: var(--muted); margin: 0; }
  nav { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  nav a { color: var(--accent); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px; background: var(--card); font-size: 13px; }
  main { max-width: 1400px; margin: 0 auto; padding: 8px 16px 48px; }
  h2.group { margin: 32px 0 0; font-size: 20px; padding-bottom: 6px; border-bottom: 2px solid var(--accent); }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px; margin-top: 16px; display: grid; gap: 12px; }
  h3 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 17px; }
  .num { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 13px; background: var(--accent); color: var(--card); font-size: 13px; }
  .note { margin: 0; color: var(--muted); max-width: 90ch; }
  .pair { display: grid; grid-template-columns: minmax(0, 3.7fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
  img { width: 100%; height: auto; display: block; border: 1px solid var(--line); border-radius: 10px; }
  .mobile img { border-radius: 18px; }
  @media (max-width: 760px) { .pair { grid-template-columns: 1fr; } .mobile { max-width: 320px; } }
</style>
</head>
<body>
<header>
  <h1>ScrumSpecter Inspector</h1>
  <p class="meta">${scenes.length} screens, each in light and dark at desktop and phone size. Captured ${esc(when)} (Dhaka) from the local test build.</p>
  <nav>${groups.map((group) => `<a href="#g-${esc(group.toLowerCase().replace(/\W+/g, "-"))}">${esc(group)}</a>`).join("")}</nav>
</header>
<main>${sections}
</main>
</body>
</html>
`);
console.log(`Wrote ${join(dir, "index.html")} with ${scenes.length} scenes`);
