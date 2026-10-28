import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

// The README's screenshots, in light and dark, at desktop and phone size. Only runs when
// README_SHOTS=<folder> is set; the shots are named <theme>-<size>-<view>.png. Afterwards,
// scripts/readme-screenshots.sh slices and frames the phone ones into docs/screenshots/.
test.skip(!process.env.README_SHOTS, "set README_SHOTS=<folder> to take the README screenshots");

const settle = async (page: Page) => {
    await expect(page.getByRole("status").filter({ hasText: "Loading…" })).toHaveCount(0, { timeout: 60_000 });
    // Entrances, counters and charts finish
    await page.waitForTimeout(1800);
};

test("README screenshots", async ({ browser, baseURL }) => {
    test.setTimeout(600_000);
    const out = process.env.README_SHOTS!;
    const admin = await registerUser(baseURL!, "Maya Rahman");
    const teammate = await registerUser(baseURL!, "Tom Becker");
    const workspace = await createWorkspace(admin.api, "Fall launch");
    const website = (await createProject(admin.api, workspace.$id, "Website", 14)).$id;
    const mobile = (await createProject(admin.api, workspace.$id, "Mobile app", 21)).$id;
    await teammate.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } });
    const members = await getMembers(admin.api, workspace.$id);
    const me = members.find((m) => m.name === admin.name)!.$id;
    const tom = members.find((m) => m.name === teammate.name)!.$id;

    // Spread over this week: some done, some open, one overdue
    const day = (offset: number, hour = 10) => {
        const date = new Date(Date.now() + 6 * 3_600_000);
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset, hour - 6)).toISOString();
    };
    const seed: [string, string, string, number, string, number, string?][] = [
        ["Hero section", website, "IN_PROGRESS", 0, me, 5, "New headline, product shot and the two call-to-action buttons from the brand kit."],
        ["Pricing table", website, "TODO", 1, tom, 3],
        ["Release notes", website, "DONE", -1, me, 2],
        ["Onboarding copy", website, "IN_REVIEW", 0, tom, 3],
        ["Fix login bug", mobile, "TODO", -2, me, 8],
        ["Push permissions", mobile, "DONE", 0, tom, 5],
        ["Dark mode icons", mobile, "TODO", 2, me, 2],
        ["Store screenshots", mobile, "DONE", 1, tom, 3],
    ];
    for (const [name, projectId, status, offset, assignee, points, description] of seed) {
        const res = await createTask(admin.api, {
            workspaceId: workspace.$id, projectId, assigneeId: assignee, name, status, description,
            dueDate: day(offset), startAt: day(offset), durationMinutes: 60, storyPoints: points,
        });
        expect(res.status(), await res.text()).toBe(200);
    }
    const routine = await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name: "Standup", projectId: website, assigneeIds: [me, tom], weekdays: [1, 2, 3, 4, 7], startTime: "09:30", durationMinutes: 15, timeZone: "Asia/Dhaka" },
    });
    expect(routine.status(), await routine.text()).toBe(200);

    const base = `/workspaces/${workspace.$id}`;
    for (const theme of ["light", "dark"] as const) {
        for (const size of ["desktop", "phone"] as const) {
            const viewport = size === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
            const context = await browser.newContext({ viewport, colorScheme: theme });
            const page = await context.newPage();
            await page.addInitScript((t) => {
                try {
                    localStorage.setItem("scrumspecter-theme", t);
                    // The "turn on reminders" prompt would sit on top of every Home shot
                    localStorage.setItem("scrumspecter-reminders-prompt-dismissed", "1");
                } catch {}
            }, theme);
            await signInBrowser(page, admin, baseURL!);
            const shot = (name: string, fullPage = false) => page.screenshot({ path: `${out}/${theme}-${size}-${name}.png`, fullPage });

            await page.goto(base, { timeout: 120_000 });
            await settle(page);
            await shot("home", true);

            await page.goto(`${base}/tasks?task-view=kanban`, { timeout: 120_000 });
            await settle(page);
            await shot("kanban");

            if (size === "phone") {
                await page.getByRole("button", { name: "Open menu" }).click();
                await page.waitForTimeout(800);
                await shot("menu");
            } else {
                await page.goto(`${base}/tasks?task-view=table`, { timeout: 120_000 });
                await settle(page);
                await shot("table");

                await page.getByRole("button", { name: "Hero section", exact: true }).click();
                await expect(page.getByRole("dialog", { name: "Hero section" })).toBeVisible();
                await page.waitForTimeout(1000);
                await shot("task-panel");
                await page.keyboard.press("Escape");

                await page.goto(`${base}/analytics`, { timeout: 120_000 });
                await settle(page);
                await page.getByRole("tab", { name: "Velocity Tracker" }).click();
                await page.waitForTimeout(1500);
                await shot("analytics");

                await page.goto(`${base}/routines`, { timeout: 120_000 });
                await settle(page);
                await shot("routines");
            }
            await context.close();
        }
    }
});
