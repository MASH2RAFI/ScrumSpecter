import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect, firefox, test, webkit, type Browser, type BrowserType, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

// Screen × browser check: every main page at phone, tablet and desktop sizes, in each browser
// that launches here. Per page it looks for things cut off at the screen edge (outside any
// scrolling box), text fields under 16px on phones (iPhone Safari zooms in on those), and errors;
// and saves a screenshot. Only runs with COMPAT=<folder>; COMPAT_BROWSERS=chromium,firefox,webkit
// picks browsers (WebKit needs its system libraries, see `npx playwright install-deps webkit`);
// COMPAT_SIZES=phone-320,iphone-xs-375 picks sizes. Also covered: browser zoom (200% and the 400%
// that WCAG's reflow rule asks for, as the CSS width they leave), a larger default text size, and
// Chromium's forced dark mode (what Android Chrome and Samsung Internet can apply to light pages).
test.skip(!process.env.COMPAT, "set COMPAT=<folder> to run the screen × browser check");

const SIZES = [
    { name: "phone-320", width: 320, height: 568, touch: true },
    // A folding phone's cover screen (Galaxy Z Fold)
    { name: "fold-344", width: 344, height: 882, touch: true },
    // The most common Android width
    { name: "android-360", width: 360, height: 800, touch: true },
    { name: "iphone-xs-375", width: 375, height: 812, touch: true },
    { name: "phone-390", width: 390, height: 844, touch: true },
    { name: "android-412", width: 412, height: 915, touch: true },
    { name: "phone-414", width: 414, height: 896, touch: true },
    { name: "iphone-max-430", width: 430, height: 932, touch: true },
    // A phone turned sideways: little height for dialogs and sticky bars
    { name: "phone-landscape-844", width: 844, height: 390, touch: true },
    { name: "tablet-768", width: 768, height: 1024, touch: true },
    { name: "ipad-air-820", width: 820, height: 1180, touch: true },
    { name: "tablet-1024", width: 1024, height: 768, touch: true },
    { name: "laptop-1280", width: 1280, height: 800, touch: false },
    // The most common laptop screens (the second is 1920 at 125% Windows scaling)
    { name: "laptop-1366", width: 1366, height: 768, touch: false },
    { name: "laptop-1536", width: 1536, height: 864, touch: false },
    { name: "desktop-1440", width: 1440, height: 900, touch: false },
    { name: "desktop-1920", width: 1920, height: 1080, touch: false },
    { name: "desktop-2560", width: 2560, height: 1440, touch: false },
    // Browser zoom: 1440×900 at 200%, and 1280 wide at 400% (WCAG 1.4.10 reflow)
    { name: "zoom-200", width: 720, height: 450, touch: false },
    { name: "zoom-400", width: 320, height: 225, touch: false },
    // Text set larger in the browser or phone settings (the default 16px raised to 20px)
    { name: "large-text-390", width: 390, height: 844, touch: true, fontScale: 1.25 },
    { name: "large-text-1440", width: 1440, height: 900, touch: false, fontScale: 1.25 },
];

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const BROWSERS: Record<string, { type: BrowserType; options: Parameters<BrowserType["launch"]>[0]; sizes?: string[] }> = {
    chromium: { type: chromium, options: { executablePath: CHROMIUM_PATH, args: ["--no-sandbox"] } },
    // Auto-darkened light pages, at a few sizes (the layout is the same as plain Chromium)
    "chromium-forcedark": {
        type: chromium,
        options: { executablePath: CHROMIUM_PATH, args: ["--no-sandbox", "--enable-features=WebContentsForceDark"] },
        sizes: ["android-360", "phone-390", "desktop-1440"],
    },
    // Their own builds: the config's Chromium path would otherwise reach these launches too
    firefox: { type: firefox, options: { executablePath: firefox.executablePath(), args: [] } },
    webkit: { type: webkit, options: { executablePath: webkit.executablePath(), args: [] } },
};

type Problem = { kind: "cut-off" | "small-input" | "error"; detail: string };

// Runs in the page: elements crossing the screen's left or right edge that no scrolling or
// clipping box contains (only the outermost of each), and text fields under 16px on phones
const findProblems = (phone: boolean) => {
    const width = document.documentElement.clientWidth;
    const found: { kind: string; detail: string }[] = [];
    const describe = (el: Element) => {
        const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 4).join(".") : "";
        const label = el.getAttribute("aria-label") || el.getAttribute("data-testid") || (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
        return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${label ? ` "${label}"` : ""}`;
    };
    const contained = (el: Element) => {
        for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
            if (a === document.body) return false;
            if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return true;
        }
        return false;
    };
    const crosses = (el: Element) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.opacity === "0") return false;
        // Partly on screen and partly off (fully off-screen drawers don't count)
        return (r.right > width + 1 && r.left < width) || (r.left < -1 && r.right > 0);
    };
    for (const el of document.body.querySelectorAll("*")) {
        if (!crosses(el) || contained(el)) continue;
        if (el.parentElement && crosses(el.parentElement) && !contained(el.parentElement)) continue;
        const r = el.getBoundingClientRect();
        found.push({ kind: "cut-off", detail: `${describe(el)} spans ${Math.round(r.left)}–${Math.round(r.right)}px of ${width}` });
    }
    if (phone) {
        for (const el of document.querySelectorAll("input, textarea, select")) {
            const input = el as HTMLInputElement;
            if (["checkbox", "radio", "hidden", "range", "file", "color"].includes(input.type)) continue;
            const r = input.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const size = parseFloat(getComputedStyle(input).fontSize);
            if (size < 16) found.push({ kind: "small-input", detail: `${describe(input)} is ${size}px` });
        }
    }
    return found;
};

test("pages at every screen size, in every browser", async ({ baseURL }) => {
    test.setTimeout(3_600_000);
    const out = process.env.COMPAT!;
    mkdirSync(out, { recursive: true });

    const user = await registerUser(baseURL!, "Compat Kim");
    const workspace = await createWorkspace(user.api, "Compat");
    const ws = workspace.$id;
    const website = (await createProject(user.api, ws, "Website", 14)).$id;
    const mobile = (await createProject(user.api, ws, "Mobile app with a long name", 21)).$id;
    const me = (await getMembers(user.api, ws))[0].$id;
    const day = (offset: number, hour?: number) => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, hour ?? 0).toISOString();
    };
    const tasks: [string, string, string, number, number?][] = [
        ["Hero section", website, "IN_PROGRESS", 0, 10],
        ["Pricing table with a rather long name to wrap", website, "TODO", 1, 14],
        ["Release notes", website, "DONE", -1],
        ["Fix login bug", mobile, "TODO", -2, 9],
        ["Store screenshots", mobile, "IN_REVIEW", 2],
        ["Dark mode icons", mobile, "BACKLOG", 3],
    ];
    for (const [name, projectId, status, offset, hour] of tasks) {
        const res = await createTask(user.api, {
            workspaceId: ws, projectId, assigneeId: me, name, status, storyPoints: 3,
            dueDate: day(offset, hour), ...(hour !== undefined && { startAt: day(offset, hour), durationMinutes: 60 }),
        });
        expect(res.status(), await res.text()).toBe(200);
    }
    const base = `/workspaces/${ws}`;
    const pages: { id: string; path: string; signedOut?: boolean }[] = [
        { id: "sign-in", path: "/sign-in", signedOut: true },
        { id: "about", path: "/about", signedOut: true },
        { id: "home", path: base },
        { id: "table", path: `${base}/tasks?task-view=table` },
        { id: "kanban", path: `${base}/tasks?task-view=kanban` },
        { id: "calendar-week", path: `${base}/tasks?task-view=calendar&cal=week` },
        { id: "calendar-month", path: `${base}/tasks?task-view=calendar&cal=month` },
        { id: "routines", path: `${base}/routines` },
        { id: "projects", path: `${base}/projects` },
        { id: "project", path: `${base}/projects/${website}` },
        { id: "requests", path: `${base}/requests` },
        { id: "analytics", path: `${base}/analytics` },
        { id: "members", path: `${base}/members` },
        { id: "settings", path: `${base}/settings` },
        { id: "account", path: "/account" },
    ];

    const wanted = (process.env.COMPAT_BROWSERS ?? "chromium,chromium-forcedark,firefox,webkit").split(",");
    const results: { browser: string; size: string; page: string; problems: Problem[] }[] = [];
    const skipped: Record<string, string> = {};

    for (const name of wanted) {
        let browser: Browser;
        try {
            browser = await BROWSERS[name].type.launch(BROWSERS[name].options);
        } catch (error) {
            skipped[name] = String((error as Error).message).split("\n")[0];
            continue;
        }
        const sizes = SIZES.filter((s) => (!process.env.COMPAT_SIZES || process.env.COMPAT_SIZES.split(",").includes(s.name))
            && (!BROWSERS[name].sizes || BROWSERS[name].sizes!.includes(s.name)));
        for (const size of sizes) {
            // Firefox has no mobile emulation; touch and the viewport are what matter here
            const context = await browser.newContext({
                viewport: { width: size.width, height: size.height },
                hasTouch: size.touch,
                ...(name !== "firefox" && { isMobile: size.width < 768 }),
                timezoneId: "Asia/Dhaka",
            });
            await context.addInitScript(() => {
                try { localStorage.setItem("scrumspecter-reminders-prompt-dismissed", "1"); } catch {}
            });
            const signedIn = await context.newPage();
            await signInBrowser(signedIn, user, baseURL!);
            for (const target of pages) {
                const page: Page = target.signedOut ? await browser.newPage({ viewport: { width: size.width, height: size.height } }) : signedIn;
                const errors: string[] = [];
                const onError = (e: Error) => errors.push(e.message);
                const onConsole = (m: { type(): string; text(): string }) => { if (m.type() === "error") errors.push(m.text()); };
                page.on("pageerror", onError);
                page.on("console", onConsole);
                await page.goto(target.path, { timeout: 120_000, waitUntil: "load" });
                // A page stuck loading is a finding (with its screenshot), not the end of the run
                const stuck = await expect(page.getByRole("status").filter({ hasText: "Loading…" })).toHaveCount(0, { timeout: 60_000 })
                    .then(() => false, () => true);
                if ("fontScale" in size && size.fontScale) await page.addStyleTag({ content: `html { font-size: ${size.fontScale * 100}% !important; }` });
                await page.waitForTimeout(900);
                const problems = (await page.evaluate(findProblems, size.width < 768)) as Problem[];
                problems.push(...errors.map((detail) => ({ kind: "error" as const, detail })));
                if (stuck) problems.push({ kind: "error", detail: "still loading after 60s" });
                await page.screenshot({ path: `${out}/${name}-${size.name}-${target.id}.jpg`, type: "jpeg", quality: 70 });
                results.push({ browser: name, size: size.name, page: target.id, problems });
                page.off("pageerror", onError);
                page.off("console", onConsole);
                if (target.signedOut) await page.close();
            }
            await context.close();
        }
        await browser.close();
    }
    writeFileSync(`${out}/report.json`, JSON.stringify({ skipped, results }, null, 2));
    const bad = results.filter((r) => r.problems.length);
    console.log(`checked ${results.length} page views; ${bad.length} with problems; skipped: ${JSON.stringify(skipped)}`);
});
