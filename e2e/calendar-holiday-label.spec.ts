import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, registerUser, signInBrowser } from "./helpers";

// A long day-off name in the week's all-day strip is cut to its cell: the strip's cells stay as wide as the columns around them
test("a long holiday name does not widen its column in the week view", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Label Lia");
    const workspace = await createWorkspace(user.api, "Label WS");
    await createProject(user.api, workspace.$id, "Label project");
    // Today is in the week shown
    const today = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
    const made = await user.api.post(`/api/workspaces/${workspace.$id}/holidays`, { data: { date: today, name: "National Revolution and Solidarity Day", kind: "custom" } });
    expect(made.status(), await made.text()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dhaka" });
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    await expect(page.locator(".day-off-label", { hasText: "National Revolution" })).toBeVisible({ timeout: 30_000 });
    const widths = await page.evaluate(() => ({
        strip: Array.from(document.querySelectorAll(".rbc-time-header-content .rbc-allday-cell .rbc-day-bg")).map((e) => e.getBoundingClientRect().width),
        columns: Array.from(document.querySelectorAll(".rbc-time-content .rbc-day-slot")).map((e) => e.getBoundingClientRect().width),
    }));
    expect(widths.strip).toHaveLength(7);
    // Every strip cell is as wide as its column below it (to the pixel)
    widths.strip.forEach((width, index) => expect(Math.abs(width - widths.columns[index]), `cell ${index}: ${widths.strip} vs ${widths.columns}`).toBeLessThan(2));
    // The whole name is still there to read on hover
    await expect(page.locator(".day-off-label", { hasText: "National Revolution" })).toHaveAttribute("title", /National Revolution and Solidarity Day/);
    await page.close();
});
