import { expect, test } from "@playwright/test";

import { createWorkspace, registerUser, signInBrowser, watchConsole } from "./helpers";

// A page that is told "nobody is signed in" must not keep that answer in the browser's saved copy:
// a later sign-in that doesn't go through the sign-in form (Google, a new session cookie) would load
// "nobody" and hide the admin's controls until something refetched (it did, in Firefox).
test("a signed-out answer isn't saved, so the next visit shows admin controls", async ({ page, baseURL }) => {
    const errors = watchConsole(page);
    const admin = await registerUser(baseURL!, "Cached Cleo");
    const workspace = await createWorkspace(admin.api, "Cache WS");
    await signInBrowser(page, admin, baseURL!);

    // The server says nobody is signed in (as a session that ended elsewhere would): for a request
    // of its own, and for the one inside a batch (the page's requests travel together)
    const nobody = (route: import("@playwright/test").Route) =>
        route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
    const nobodyInBatch = async (route: import("@playwright/test").Route) => {
        const response = await route.fetch();
        const requests = (JSON.parse(route.request().postData() ?? "{}") as { requests: string[] }).requests;
        const { results } = await response.json() as { results: object[] };
        await route.fulfill({
            response,
            json: { results: results.map((result, index) => requests[index].endsWith("/api/auth/current")
                ? { status: 401, type: "application/json", body: JSON.stringify({ error: "Unauthorized" }) } : result) },
        });
    };
    await page.route("**/api/auth/current", nobody);
    await page.route("**/api/batch", nobodyInBatch);
    const asked = page.waitForResponse((response) => response.url().endsWith("/api/batch") || response.url().endsWith("/api/auth/current"));
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    await asked;
    // The saved copy is written a moment after a change
    await page.waitForTimeout(2_500);
    const saved = await page.evaluate(() => {
        const raw = window.localStorage.getItem("scrumspecter-cache");
        return raw ? (JSON.parse(raw).clientState.queries as { queryKey: unknown[]; state: { data: unknown } }[]) : [];
    });
    expect(saved.filter((query) => query.queryKey[0] === "current" && query.state.data === null)).toEqual([]);

    // Signed in again: the admin's controls are there
    await page.unroute("**/api/auth/current", nobody);
    await page.unroute("**/api/batch", nobodyInBatch);
    await page.reload({ timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await expect(settings.getByRole("tab", { name: "Danger zone" })).toBeEnabled();
    expect(errors.filter((error) => !/401/.test(error)), errors.join("\n")).toEqual([]);
});
