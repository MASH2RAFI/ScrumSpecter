// Sign in through the form like a person, then time the first dashboard screen. node scripts/perf/login-flow.mjs [runs] [browserLatencyMs] [typingMs]
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3200";
const RUNS = Number(process.argv[2] || 3);
const NET = Number(process.argv[3] || 0);
const TYPING = Number(process.argv[4] || 3000);
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const rows = [];
for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    if (NET) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: NET, downloadThroughput: 1_500_000, uploadThroughput: 750_000 });
    }
    const sizes = new Map();
    const events = [];
    let clicked = null;
    const scripts = [];
    page.on("request", (r) => { if (clicked !== null && r.resourceType() !== "script" && !r.url().includes("/_next/static")) events.push({ t: Date.now() - clicked, what: r.method() + " " + r.url().replace(BASE, "").split("?")[0].slice(0, 60) + " (" + r.resourceType() + ")" }); if (r.resourceType() === "script") scripts.push({ url: r.url(), at: Date.now(), after: clicked !== null }); });
    page.on("response", async (r) => { if (r.request().resourceType() === "script") sizes.set(r.url(), Number(r.headers()["content-length"] || 0)); });
    await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
    await page.getByPlaceholder("Enter email address").fill("dana@demo.test");
    await page.getByPlaceholder("Enter password").fill("demo-password-123");
    await page.waitForTimeout(TYPING);
    clicked = Date.now();
    scripts.forEach((s) => (s.after = s.at >= clicked));
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.getByText("Overdue").first().waitFor({ state: "visible", timeout: 90_000 });
    const visible = Date.now() - clicked;
    const late = scripts.filter((s) => s.after);
    if (process.env.DETAIL && run === RUNS - 1) events.forEach((e) => console.log(String(e.t).padStart(6), "ms", e.what));
    rows.push({ visible, lateScripts: late.length, lateKB: Math.round(late.reduce((n, s) => n + (sizes.get(s.url) || 0), 0) / 1024), totalScripts: scripts.length });
    await context.close();
}
await browser.close();
const med = (k) => rows.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
console.log(`sign-in -> dashboard, typing ${TYPING} ms, browser latency ${NET} ms, ${RUNS} runs`);
console.log(`median: click to content ${med("visible")} ms · scripts fetched after the click ${med("lateScripts")} of ${med("totalScripts")} (~${med("lateKB")} KB)`);
