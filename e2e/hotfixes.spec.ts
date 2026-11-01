import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

// A member's display name goes into the sprint report's HTML; it must stay text
test("sprint report PDF doesn't run HTML from a member's name", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const payload = `<img src=x onerror="window.__xss=1">`;
    const user = await registerUser(baseURL!, payload);
    const workspaceId = (await createWorkspace(user.api, "XSS WS")).$id;
    const projectId = (await createProject(user.api, workspaceId, "XSS Project")).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;
    await createTask(user.api, { workspaceId, projectId, assigneeId: memberId });

    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/analytics`);
    await page.getByRole("tab", { name: "Sprint Report" }).click();
    await page.getByRole("tabpanel").locator("#project-select").click();
    await page.getByRole("option", { name: "XSS Project" }).click();
    await expect(page.getByText(payload).first()).toBeVisible();

    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: "Generate PDF Report" }).click();
    await download;
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

// Postgres caps one statement at 65,535 parameters (~5,000 task rows); generation must batch
test("extending a sprint creates more than 6,000 routine tasks in one go", async ({ baseURL }) => {
    test.setTimeout(180_000);
    const user = await registerUser(baseURL!, "Bulk Routine Admin");
    const workspaceId = (await createWorkspace(user.api, "Big Routine WS")).$id;
    const projectId = (await createProject(user.api, workspaceId, "Long Sprint", 1)).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;

    const routineCount = 18;
    for (let i = 0; i < routineCount; i++) {
        const res = await user.api.post("/api/routines", {
            data: { workspaceId, name: `Daily ${i}`, projectId, assigneeIds: [memberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
        });
        expect(res.status(), await res.text()).toBe(200);
    }

    // One generateRoutineTasks call for all 18 routines: 18 x ~365 days > 6,000 rows
    const res = await user.api.patch(`/api/projects/${projectId}`, { multipart: { workspaceId, currentSprintEndDate: isoDay(364) } });
    expect(res.status(), await res.text()).toBe(200);

    // Public holidays are skipped, so count everything rather than days x routines
    const list = await user.api.get(`/api/tasks?workspaceId=${workspaceId}&projectId=${projectId}`);
    expect(list.status()).toBe(200);
    expect((await list.json()).data.documents.length).toBeGreaterThan(6000);
});
