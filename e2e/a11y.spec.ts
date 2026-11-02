import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, type TestUser } from "./helpers";

// Automated accessibility checks (axe, WCAG 2 A and AA) on the main pages, in both themes
test.describe.configure({ mode: "serial" });

let user: TestUser;
let workspaceId: string;

// shortcut: two issues come from libraries, not our markup; revisit if either library is replaced or fixes them:
// - @hello-pangea/dnd makes the whole Kanban card role="button" (its keyboard drag), around the card's own buttons
// - react-big-calendar's month grid puts role="row" on a wrapper without cells
const knownLibraryIssue = (rule: string, target: string) =>
    (rule === "nested-interactive" && target.includes("data-rfd-draggable")) ||
    (rule === "aria-required-children" && target.includes("rbc-"));

const scan = async (page: Page, label: string) => {
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const violations = results.violations
        .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !knownLibraryIssue(v.id, n.target.join(" "))) }))
        .filter((v) => v.nodes.length);
    const summary = violations.map((v) => `${label} · ${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`);
    if (process.env.A11Y_DUMP) for (const v of violations) for (const n of v.nodes.slice(0, 4)) console.log(`A11Y|${label}|${v.id}|${n.target.join(" ")}|${n.html.slice(0, 160)}`);
    expect.soft(summary, summary.join("\n")).toEqual([]);
};

const open = async (page: Page, path: string, ready: () => Promise<void>) => {
    await page.goto(path, { timeout: 90_000 });
    await ready();
    // Let entrance animations settle so contrast is measured on final colors (staggered lists
    // finish later the longer they are, so wait for them rather than a fixed time)
    await page.waitForTimeout(300);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 10_000 });
    await page.waitForTimeout(200);
};

test.beforeAll(async ({ baseURL }) => {
    user = await registerUser(baseURL!, "Ada Access");
    workspaceId = (await createWorkspace(user.api, "Access WS")).$id;
    const projectId = (await createProject(user.api, workspaceId, "Launch")).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;
    for (const [name, status] of [["Write copy", "TODO"], ["Review design", "IN_REVIEW"], ["Ship it", "DONE"]]) {
        await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name, status });
    }
});

for (const scheme of ["light", "dark"] as const) {
    test(`public pages (${scheme})`, async ({ browser }) => {
        const page = await (await browser.newContext({ colorScheme: scheme })).newPage();
        await open(page, "/about", async () => { await expect(page.getByRole("heading").first()).toBeVisible(); });
        await scan(page, "about");
        await open(page, "/sign-in", async () => { await expect(page.getByPlaceholder("Enter email address")).toBeVisible(); });
        await scan(page, "sign-in");
        await page.close();
    });

    test(`signed-in pages (${scheme})`, async ({ browser, baseURL }) => {
        const page = await (await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } })).newPage();
        await signInBrowser(page, user, baseURL!);
        const base = `/workspaces/${workspaceId}`;
        const pages: [string, string, string][] = [
            ["home", base, "Write copy"],
            ["table", `${base}/tasks?task-view=table`, "Write copy"],
            ["kanban", `${base}/tasks?task-view=kanban`, "Write copy"],
            ["calendar", `${base}/tasks?task-view=calendar`, "Unscheduled"],
            ["routines", `${base}/routines`, "Routines"],
            ["analytics", `${base}/analytics`, "Analytics"],
            ["account", "/account", "Account settings"],
        ];
        for (const [label, path, text] of pages) {
            await open(page, path, async () => { await expect(page.getByText(text).first()).toBeVisible(); });
            await scan(page, `${label} (${scheme})`);
        }
        await page.close();
    });
}
