import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, registerUser, signInBrowser, watchConsole } from "./helpers";

// A modal's code is fetched the first time it opens (components/lazy-modals.tsx). On a slow connection that takes a while,
// and the tap must visibly do something: after a moment the screen dims and shows the outline of a dialog.
test("a modal whose code is slow to arrive shows a loading outline, then the modal", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Slow Sue");
    const workspace = await createWorkspace(user.api, "Slow WS");
    await createProject(user.api, workspace.$id, "Slow project");
    // A phone: nothing is fetched ahead for later (lazy-parts.tsx), so the first open really fetches
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    // From here every script comes slowly, as on a slow connection
    await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        await route.continue().catch(() => undefined);
    });
    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(page.getByRole("status", { name: "Loading" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog", { name: "Create task" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// If the code never arrives (a dropped connection), the screen must not turn into the error page: a message with a way out
test("a modal whose code cannot be fetched shows a message, not the error screen", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Offline Ola");
    const workspace = await createWorkspace(user.api, "Offline WS");
    await createProject(user.api, workspace.$id, "Offline project");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    // From here no script can be fetched
    await page.route(/\/_next\/static\/chunks\/.*\.js/, (route) => route.abort());
    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(page.getByText("Couldn't open that").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    // The page is still there, not replaced by the error screen
    await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    await page.close();
});

// A request that never answers is no better than one that fails: after a limit the same message appears and the screen is freed
test("a modal whose code never arrives shows the message after a while, and the screen is usable again", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const user = await registerUser(baseURL!, "Stalled Stu");
    const workspace = await createWorkspace(user.api, "Stalled WS");
    await createProject(user.api, workspace.$id, "Stalled project");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    // From here script requests are left hanging: no answer, no error
    await page.route(/\/_next\/static\/chunks\/.*\.js/, () => undefined);
    await page.getByRole("button", { name: "New", exact: true }).click();
    await expect(page.getByRole("status", { name: "Loading" })).toBeVisible({ timeout: 10_000 });
    // Two tries of 10 s, then the message; the dimmed screen goes
    await expect(page.getByText("Couldn't open that").first()).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible();
    await page.close();
});
