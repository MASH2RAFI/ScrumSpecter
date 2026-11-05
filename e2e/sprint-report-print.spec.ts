import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

// A member's display name goes into the printable sprint report; it must stay text
test("sprint report print doesn't run HTML from a member's name", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const payload = `<img src=x onerror="window.__xss=1">`;
    const user = await registerUser(baseURL!, payload);
    const workspaceId = (await createWorkspace(user.api, "XSS WS")).$id;
    const projectId = (await createProject(user.api, workspaceId, "XSS Project")).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;
    await createTask(user.api, { workspaceId, projectId, assigneeId: memberId });

    // Record print calls instead of opening the browser's print dialog
    await page.addInitScript(() => {
        const w = window as unknown as { __printCalls: number };
        w.__printCalls = 0;
        window.print = () => { w.__printCalls++; };
    });

    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/analytics`);
    await page.getByRole("tab", { name: "Sprint Report" }).click();
    await page.getByRole("tabpanel").locator("#project-select").click();
    await page.getByRole("option", { name: "XSS Project" }).click();
    await expect(page.getByText(payload).first()).toBeVisible();

    await page.getByRole("button", { name: "Print / Save as PDF" }).click();
    expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(1);

    const report = page.locator("#sprint-report-print");
    await expect(report).toContainText(payload);
    await expect(report.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

// The breakdown covers every status, so its parts add up to the task total
test("sprint report: the status breakdown adds up to the total", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const user = await registerUser(baseURL!, "Rhea Report");
    const workspaceId = (await createWorkspace(user.api, "Breakdown WS")).$id;
    const projectId = (await createProject(user.api, workspaceId, "Breakdown Project")).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;
    const counts = { BACKLOG: 1, TODO: 2, IN_PROGRESS: 1, IN_REVIEW: 3, DONE: 2 } as const;
    for (const [status, count] of Object.entries(counts)) {
        for (let i = 0; i < count; i++) {
            const res = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: `${status} ${i}`, status });
            expect(res.status(), await res.text()).toBe(200);
        }
    }

    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/analytics`);
    await page.getByRole("tab", { name: "Sprint Report" }).click();
    await page.getByRole("tabpanel").locator("#project-select").click();
    await page.getByRole("option", { name: "Breakdown Project" }).click();
    const report = page.locator("#sprint-report-print");
    await expect(report).toContainText("Tasks Completed");
    const tile = (label: string) => report.locator("div.p-4", { has: page.locator(`p:text-is("${label}")`) });
    await expect(tile("Tasks Completed")).toContainText("2/9");
    for (const [label, count] of [["Backlog", 1], ["Todo", 2], ["In Progress", 1], ["In Review", 3], ["Done", 2]] as const) {
        await expect(tile(label), label).toContainText(String(count));
    }
});
