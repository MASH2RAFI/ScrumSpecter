import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, type TestUser } from "./helpers";

// Browser: pages show a skeleton of what's coming while their data loads, never a spinner.
// Set SKELETON_SHOTS=<folder> to also save a screenshot of each.
test.describe.configure({ mode: "serial" });

let user: TestUser;
let workspaceId: string;
let projectId: string;
let taskId: string;

test.beforeAll(async ({ baseURL }) => {
    user = await registerUser(baseURL!, "Skel Sam");
    workspaceId = (await createWorkspace(user.api, "Skeletons")).$id;
    projectId = (await createProject(user.api, workspaceId, "Website", 14)).$id;
    const [me] = await getMembers(user.api, workspaceId);
    taskId = (await (await createTask(user.api, { workspaceId, projectId, assigneeId: me.$id, name: "Hero section" })).json()).data.$id;
});

const PAGES = [
    { name: "home", path: () => "" },
    { name: "tasks", path: () => "/tasks" },
    { name: "project", path: () => `/projects/${projectId}` },
    { name: "task", path: () => `/tasks/${taskId}` },
    { name: "routines", path: () => "/routines" },
    { name: "requests", path: () => "/requests" },
];

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const size = viewport.width < 640 ? "phone" : "desktop";

    test(`${size}: every page shows its skeleton while loading`, async ({ browser, baseURL }) => {
        test.setTimeout(240_000);
        // Compile the pages first, so the held requests below are the only thing being waited on
        const warm = await browser.newPage({ viewport });
        await signInBrowser(warm, user, baseURL!);
        for (const { path } of PAGES) await warm.goto(`/workspaces/${workspaceId}${path()}`, { timeout: 120_000 });
        await warm.close();

        for (const { name, path } of PAGES) {
            // A fresh context: no browser cache to restore, so the page has to wait for the API
            const context = await browser.newContext({ viewport });
            const page = await context.newPage();
            await signInBrowser(page, user, baseURL!);
            // Workspace data is never answered; the signed-in user still is
            await page.route("**/api/**", (route) =>
                /\/api\/auth\/current/.test(route.request().url()) ? route.continue() : undefined);

            await page.goto(`/workspaces/${workspaceId}${path()}`);
            const status = page.getByRole("status").filter({ hasText: "Loading…" }).first();
            await expect(status, name).toBeVisible();
            await expect(status.locator(".animate-pulse").first(), name).toBeVisible();
            await expect(page.locator(".animate-spin"), name).toHaveCount(0);
            if (process.env.SKELETON_SHOTS) {
                await page.screenshot({ path: `${process.env.SKELETON_SHOTS}/skel-${size}-${name}.png` });
            }
            await context.close();
        }
    });
}
