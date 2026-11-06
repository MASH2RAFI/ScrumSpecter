// Cold signed-in first load of the workspace home. node scripts/perf/measure.mjs [runs] [browserLatencyMs]
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3200";
const RUNS = Number(process.argv[2] || 5);
const NET_LATENCY = Number(process.argv[3] || 0);
const PASSWORD = "demo-password-123";

const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dana@demo.test", password: PASSWORD }) });
const token = login.headers.get("set-cookie").split(";")[0].split("=").slice(1).join("=");
const cookieName = login.headers.get("set-cookie").split("=")[0];
const workspaces = await (await fetch(`${BASE}/api/workspaces`, { headers: { cookie: `${cookieName}=${token}` } })).json();
const workspaceId = workspaces.data.documents.find((w) => w.name === "Demo Studio").$id;

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const results = [];
for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies([{ name: cookieName, value: token, url: BASE, httpOnly: true, secure: true }]);
    const page = await context.newPage();
    if (NET_LATENCY) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: NET_LATENCY, downloadThroughput: 1_500_000, uploadThroughput: 750_000 });
    }
    const start = Date.now();
    const calls = [];
    page.on("request", (r) => { if (process.env.SHOWBODY && r.url().endsWith("/api/batch")) console.log(JSON.parse(r.postData()).requests.join("\n")); if (r.url().includes("/api/")) calls.push({ url: r.url().replace(BASE, "").split("?")[0], t0: Date.now() - start, method: r.method() }); });
    page.on("requestfinished", (r) => { const c = calls.find((x) => x.url === r.url().replace(BASE, "").split("?")[0] && x.t1 === undefined); if (c) c.t1 = Date.now() - start; });
    let html;
    page.on("response", (r) => { if (r.request().resourceType() === "document" && html === undefined) html = Date.now() - start; });
    await page.goto(`${BASE}/workspaces/${workspaceId}`, { waitUntil: "commit" });
    await page.getByText("Overdue").first().waitFor({ state: "visible", timeout: 60_000 });
    const visible = Date.now() - start;
    await page.getByText("Demo Studio").first().waitFor({ state: "visible" });
    const settled = Date.now();
    await page.waitForLoadState("networkidle");
    const idle = Date.now() - start;
    results.push({ html, visible, idle, calls: calls.length, lastApi: Math.max(...calls.map((c) => c.t1 ?? 0)), detail: calls });
    await context.close();
}
await browser.close();
const med = (key) => results.map((r) => r[key]).sort((a, b) => a - b)[Math.floor(results.length / 2)];
console.log(`runs ${RUNS}, browser latency ${NET_LATENCY} ms`);
console.log(`median: document ${med("html")} ms · content visible ${med("visible")} ms · network idle ${med("idle")} ms · ${med("calls")} API calls · last API reply ${med("lastApi")} ms`);
if (process.env.DETAIL) for (const c of results[results.length - 1].detail) console.log(`  ${String(c.t0).padStart(5)}–${String(c.t1 ?? "?").padStart(5)} ms  ${c.method} ${c.url}`);
