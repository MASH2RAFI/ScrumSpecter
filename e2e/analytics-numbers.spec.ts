import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// Analytics: the velocity trend looks at the newest projects, and the capacity total always
// matches what is on screen
test.describe.configure({ mode: "serial" });

test("velocity: the trend follows the newest projects, oldest to newest", async ({ page, baseURL }) => {
    const errors = watchConsole(page);
    const admin = await registerUser(baseURL!, "Velo Val");
    const workspace = await createWorkspace(admin.api, "Velocity WS");
    const [me] = await getMembers(admin.api, workspace.$id);
    // Five projects, created oldest first: the three old ones finished everything, the two newest nothing
    for (const [index, done] of [true, true, true, false, false].entries()) {
        const project = await createProject(admin.api, workspace.$id, `Sprint ${index + 1}`);
        await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name: `Work ${index + 1}`, storyPoints: 10, status: done ? "DONE" : "TODO" });
    }

    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/analytics`, { timeout: 90_000 });
    await page.getByRole("tab", { name: "Velocity Tracker" }).click();

    // Average 60 %; the latest three (100, 0, 0 = 33 %) are well below it. The old code took the
    // oldest three (all 100 %) and said "increasing"
    await expect(page.getByText("decreasing", { exact: false })).toBeVisible();
    const rows = page.locator("table.sr-only tbody tr td:first-child");
    await expect(rows).toHaveText(["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4", "Sprint 5"]);
    expect(errors, errors.join("\n")).toEqual([]);
});

test("capacity: the total follows every edit and project change, and typed numbers stay in range", async ({ page, baseURL }) => {
    const admin = await registerUser(baseURL!, "Cap Cy");
    const workspace = await createWorkspace(admin.api, "Capacity WS");
    const [me] = await getMembers(admin.api, workspace.$id);
    const busy = await createProject(admin.api, workspace.$id, "Busy");
    await createProject(admin.api, workspace.$id, "Empty");
    await createTask(admin.api, { workspaceId: workspace.$id, projectId: busy.$id, assigneeId: me.$id, name: "Work" });

    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/analytics`, { timeout: 90_000 });
    await page.getByRole("tab", { name: "Capacity Calculator" }).click();
    const pick = async (name: string) => {
        await page.locator("#project-select").click();
        await page.getByRole("option", { name }).click();
    };
    const total = page.getByText(/^\d+ hours$/);

    // One person, 8 hours a day, fully available, 14 days: 112 hours, with no button to press
    await pick("Busy");
    await expect(total).toHaveText("112 hours");
    // The number boxes in page order: sprint days, then the person's daily hours and availability
    const numbers = page.locator('input[type="number"]');
    const daily = numbers.nth(1);
    const availability = numbers.nth(2);
    await availability.fill("50");
    await expect(total).toHaveText("56 hours");
    // Out-of-range numbers are held at the limits
    // (retried: a refetch of the page's data can land just as a box is filled, and WebKit then keeps the old value)
    await expect(async () => {
        await availability.fill("500");
        await expect(availability).toHaveValue("100", { timeout: 1_500 });
    }).toPass();
    await expect(async () => {
        await daily.fill("30");
        await expect(daily).toHaveValue("24", { timeout: 1_500 });
    }).toPass();
    await expect(total).toHaveText("336 hours");

    // Another project has nobody assigned: its total is its own, not the last one's
    await pick("Empty");
    await expect(total).toHaveText("0 hours");
});
