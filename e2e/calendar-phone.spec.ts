import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// Phone-size calendar, and a task that runs past midnight
test("week on a phone opens at today's column; a task past midnight stays in the time grid", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Phone Pia");
    const workspace = await createWorkspace(user.api, "Phone WS");
    const project = await createProject(user.api, workspace.$id, "Phone project");
    const [me] = await getMembers(user.api, workspace.$id);
    // Today 23:00 for two hours in Dhaka (UTC+6): it ends at 01:00 tomorrow
    const dhaka = new Date(Date.now() + 6 * 3_600_000);
    const at = (hours: number) => new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate(), hours - 6)).toISOString();
    const made = await createTask(user.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name: "Past midnight", dueDate: at(12), startAt: at(23), durationMinutes: 120 });
    expect(made.status(), await made.text()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Dhaka" });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    const today = page.locator(".rbc-time-view .rbc-header.rbc-today");
    await expect(today).toBeVisible();
    // Inside the screen, whatever weekday today is
    await expect.poll(async () => {
        const box = await today.boundingBox();
        return box !== null && box.x >= 0 && box.x + box.width <= 391;
    }).toBe(true);

    // In the time grid, like any other timed task: not as a bar in the all-day row
    await expect(page.locator(".rbc-time-content .rbc-event", { hasText: "Past midnight" })).toHaveCount(1);
    await expect(page.locator(".rbc-allday-cell .rbc-event", { hasText: "Past midnight" })).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});
