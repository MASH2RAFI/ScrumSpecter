import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: the Home dashboard's numbers and links, and every page with motion on and with the
// system asking for reduced motion
test.describe.configure({ mode: "serial" });

let user: TestUser;
let workspaceId: string;
let projectId: string;

test.beforeAll(async ({ baseURL }) => {
    user = await registerUser(baseURL!, "Dana Dashboard");
    workspaceId = (await createWorkspace(user.api, "Dashboard")).$id;
    projectId = (await createProject(user.api, workspaceId, "Website", 14)).$id;
    const [me] = await getMembers(user.api, workspaceId);
    for (const [name, status] of [["Write copy", "TODO"], ["Build hero", "IN_PROGRESS"], ["Review hero", "IN_REVIEW"], ["Ship logo", "DONE"]] as const) {
        const res = await createTask(user.api, { workspaceId, projectId, assigneeId: me.$id, name, status, storyPoints: 2 });
        expect(res.status(), await res.text()).toBe(200);
    }
});

test("Home's stat cards count the tasks and open the matching list", async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });

    await expect(page.getByRole("link", { name: /^All tasks: 4\./ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^In progress: 2\. 1 waiting for review/ })).toBeVisible();
    // Reduced motion: the number is there at once, not counting up
    const done = page.getByRole("link", { name: /^Done: 1\./ });
    await expect(done).toContainText("1");
    await expect(page.getByRole("heading", { name: "Sprint progress" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Website: 25% of 8 story points done/ })).toBeVisible();

    await done.click();
    // The first visit to My Tasks compiles it, which can be slow while other tests run
    await expect(page).toHaveURL(/\/tasks\?status=DONE/, { timeout: 60_000 });
    await expect(page.getByRole("cell", { name: "Ship logo", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Write copy", exact: true })).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`every page renders (${reducedMotion === "reduce" ? "reduced motion" : "with motion"})`, async ({ browser, baseURL }) => {
        test.setTimeout(240_000);
        const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
        const errors = watchConsole(page);
        await page.emulateMedia({ reducedMotion });
        await signInBrowser(page, user, baseURL!);
        for (const path of ["", "/tasks", "/tasks?task-view=kanban", "/tasks?task-view=calendar", `/projects/${projectId}`, "/routines", "/requests", "/analytics"]) {
            await page.goto(`/workspaces/${workspaceId}${path}`, { timeout: 90_000 });
            await expect(page.getByRole("main"), path).toBeVisible();
            await expect(page.getByRole("status").filter({ hasText: "Loading…" }), path).toHaveCount(0, { timeout: 30_000 });
        }
        // The sliding nav highlight follows the page
        await expect(page.locator('a[aria-current="page"]')).toHaveCount(1);
        expect(errors, errors.join("\n")).toEqual([]);
        await page.close();

        // About is for signed-out visitors (signed-in ones go to their workspace)
        const visitor = await browser.newPage({ viewport: { width: 1280, height: 860 } });
        const visitorErrors = watchConsole(visitor);
        await visitor.emulateMedia({ reducedMotion });
        await visitor.goto("/about", { timeout: 90_000 });
        await expect(visitor.getByRole("heading", { name: "Welcome to ScrumSpecter" })).toBeVisible();
        expect(visitorErrors, visitorErrors.join("\n")).toEqual([]);
        await visitor.close();
    });
}
