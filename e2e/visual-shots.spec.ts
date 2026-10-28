import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

// Screenshots for reviewing the design, in light and dark at desktop and phone size.
// Only runs when VISUAL_SHOTS=<folder> is set.
test.skip(!process.env.VISUAL_SHOTS, "set VISUAL_SHOTS=<folder> to take screenshots");

test("design screenshots", async ({ browser, baseURL }) => {
    test.setTimeout(600_000);
    const out = process.env.VISUAL_SHOTS!;
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
    const seed: [string, string, string, number, string, number][] = [
        ["Hero section", website, "IN_PROGRESS", 0, me, 5],
        ["Pricing table", website, "TODO", 1, tom, 3],
        ["Release notes", website, "DONE", -1, me, 2],
        ["Onboarding copy", website, "IN_REVIEW", 0, tom, 3],
        ["Fix login bug", mobile, "TODO", -2, me, 8],
        ["Push permissions", mobile, "DONE", 0, tom, 5],
        ["Dark mode icons", mobile, "TODO", 2, me, 2],
        ["Store screenshots", mobile, "DONE", 1, tom, 3],
    ];
    for (const [name, projectId, status, offset, assignee, points] of seed) {
        const res = await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: assignee, name, status, dueDate: day(offset), startAt: day(offset), durationMinutes: 60, storyPoints: points });
        expect(res.status(), await res.text()).toBe(200);
    }

    const pages = [
        ["home", ""],
        ["tasks", "/tasks"],
        ["kanban", "/tasks?task-view=kanban"],
        ["calendar", "/tasks?task-view=calendar"],
        ["project", `/projects/${website}`],
        ["analytics", "/analytics"],
        ["routines", "/routines"],
    ] as const;

    for (const theme of ["light", "dark"] as const) {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
            const size = viewport.width < 640 ? "phone" : "desktop";
            const context = await browser.newContext({ viewport, colorScheme: theme });
            const page = await context.newPage();
            await page.addInitScript((t) => {
                try { localStorage.setItem("scrumspecter-theme", t); } catch {}
            }, theme);
            await signInBrowser(page, admin, baseURL!);
            for (const [name, path] of pages) {
                await page.goto(`/workspaces/${workspace.$id}${path}`, { timeout: 120_000 });
                await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
                // Let entrances, counters and charts finish
                await page.waitForTimeout(1800);
                await page.screenshot({ path: `${out}/${name}-${theme}-${size}.png`, fullPage: name === "home" });
            }
            // Getting started: the default tab and bulk input
            for (const [name, query] of [["get-started", ""], ["get-started-bulk", "?start=bulk"]] as const) {
                await page.goto(`/workspaces/create${query}`, { timeout: 120_000 });
                await page.waitForTimeout(1500);
                await page.screenshot({ path: `${out}/${name}-${theme}-${size}.png` });
            }

            // Overlays: the phone menu, the task panel and the new-task form
            await page.goto(`/workspaces/${workspace.$id}/tasks`, { timeout: 120_000 });
            await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
            if (size === "phone") {
                await page.getByRole("button", { name: "Open menu" }).click();
                await page.waitForTimeout(800);
                await page.screenshot({ path: `${out}/menu-${theme}-${size}.png` });
                await page.keyboard.press("Escape");
                await page.waitForTimeout(500);
            }
            await page.getByText("Hero section", { exact: true }).first().click();
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `${out}/panel-${theme}-${size}.png` });
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);
            await page.getByRole("button", { name: "New" }).first().click();
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `${out}/new-task-${theme}-${size}.png` });
            await page.keyboard.press("Escape");

            for (const name of ["about", "sign-in"]) {
                const anon = await browser.newContext({ viewport, colorScheme: theme });
                const p = await anon.newPage();
                await p.addInitScript((t) => { try { localStorage.setItem("scrumspecter-theme", t); } catch {} }, theme);
                await p.goto(`/${name}`, { timeout: 120_000 });
                await p.waitForTimeout(1500);
                await p.screenshot({ path: `${out}/${name}-${theme}-${size}.png` });
                await anon.close();
            }
            await context.close();
        }
    }
});
