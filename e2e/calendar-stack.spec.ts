import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

// Cards on one day cascade: each later card starts further right and sits on top of the one before, so every card shows.
// All-day tasks (they fill the working day) are cards like the rest: a timed card must not cover them.
test("all-day and timed cards on the same day cascade, each with a left edge of its own", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Stack Sol");
    const workspace = await createWorkspace(user.api, "Stack WS");
    const project = await createProject(user.api, workspace.$id, "Stack project");
    const [me] = await getMembers(user.api, workspace.$id);
    const dhaka = new Date(Date.now() + 6 * 3_600_000);
    const due = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate(), 6)).toISOString();
    const start = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate(), 4)).toISOString();
    const make = (name: string, timed: boolean) =>
        createTask(user.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name, dueDate: due, startAt: timed ? start : null, durationMinutes: timed ? 90 : null });
    for (const [name, timed] of [["Stack all-day one", false], ["Stack all-day two", false], ["Stack all-day three", false], ["Stack timed", true]] as const) {
        expect((await make(name, timed)).status()).toBe(200);
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dhaka" });
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    const cards = page.locator(".rbc-time-content .rbc-event", { hasText: "Stack" });
    await expect(cards).toHaveCount(4, { timeout: 30_000 });
    const left = (await cards.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().x)))).sort((a, b) => a - b);
    // Four different left edges, each at least 15 px past the one before: nothing is hidden behind another card
    for (let i = 1; i < left.length; i++) expect(left[i] - left[i - 1], `left edges ${left}`).toBeGreaterThanOrEqual(15);
    await page.close();
});
