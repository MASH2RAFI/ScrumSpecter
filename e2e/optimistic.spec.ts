import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// Actions the person takes show their result at once, before the (here deliberately slow) server
// answers, and are put back if the server refuses.
const SLOW = 3_000;

test("reading the bell clears its badge at once, and brings it back if the server refuses", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Bell Bonnie");
    const workspace = await createWorkspace(user.api, "Bell WS");
    expect((await user.api.post("/api/notifications/test")).status()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    const bell = page.getByRole("button", { name: /^Notifications/ }).first();
    await expect(bell).toHaveAccessibleName("Notifications, 1 unread", { timeout: 30_000 });

    // Slow: the badge is gone long before the server answers
    await page.route("**/api/notifications/read", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, SLOW));
        await route.continue().catch(() => undefined);
    });
    await bell.click();
    await expect(bell).toHaveAccessibleName("Notifications", { timeout: SLOW - 1_000 });
    await page.keyboard.press("Escape");
    await page.unroute("**/api/notifications/read");
    await page.waitForTimeout(SLOW);

    // Refused: it comes back
    expect((await user.api.post("/api/notifications/test")).status()).toBe(200);
    await page.reload();
    await expect(bell).toHaveAccessibleName("Notifications, 1 unread", { timeout: 30_000 });
    await page.route("**/api/notifications/read", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await bell.click();
    await expect(bell).toHaveAccessibleName("Notifications, 1 unread", { timeout: 10_000 });
    expect(errors.filter((error) => !/500/.test(error)), errors.join("\n")).toEqual([]);
    await page.close();
});

test("approving a request shows the decision at once, and puts it back if the server refuses", async ({ browser, baseURL }) => {
    const admin = await registerUser(baseURL!, "Approve Alma");
    const assignee = await registerUser(baseURL!, "Ask Asa");
    const workspace = await createWorkspace(admin.api, "Approve WS");
    const project = await createProject(admin.api, workspace.$id, "Approve project");
    expect((await assignee.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    const members = await getMembers(admin.api, workspace.$id);
    const asked = (name: string) => assignee.api.post("/api/change-requests", {
        data: { kind: "create", workspaceId: workspace.$id, changes: { name, projectId: project.$id, assigneeIds: [members.find((m) => m.name === "Ask Asa")!.$id] } },
    });
    expect((await asked("Please add this")).status()).toBe(200);
    expect((await asked("And refuse this")).status()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/requests`, { timeout: 90_000 });

    // Slow server: the card says "Approved by …" long before the answer
    const first = page.getByLabel("New task: Please add this");
    await page.route("**/api/change-requests/*/approve", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, SLOW));
        await route.continue().catch(() => undefined);
    });
    await first.getByRole("button", { name: "Approve" }).click();
    await expect(first).toContainText(`Approved by ${admin.name}`, { timeout: SLOW - 1_000 });
    await expect(page.getByText("Approved and applied")).toBeVisible({ timeout: 15_000 });
    await page.unroute("**/api/change-requests/*/approve");

    // Refused: the card is waiting for review again
    const second = page.getByLabel("New task: And refuse this");
    await page.route("**/api/change-requests/*/decline", (route) =>
        route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "No longer possible" }) }));
    await second.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("No longer possible")).toBeVisible({ timeout: 10_000 });
    await expect(second.getByRole("button", { name: "Decline" })).toBeVisible();
    expect(errors.filter((error) => !/400/.test(error)), errors.join("\n")).toEqual([]);
    await page.close();
});
