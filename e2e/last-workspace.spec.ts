import { expect, test, type Page } from "@playwright/test";

import { createWorkspace, registerUser, signInBrowser, userFromPage, watchConsole, type TestUser } from "./helpers";

// "/" reopens the workspace last opened on this device (a cookie), not the newest one
test.describe.configure({ mode: "serial" });

let owner: TestUser, user: TestUser;
let a: { $id: string; inviteCode: string }, b: { $id: string };
let page: Page;
let errors: string[];

test.beforeAll(async ({ browser, baseURL }) => {
    owner = await registerUser(baseURL!, "Owner Oz");
    user = await registerUser(baseURL!, "Last Lou");
    // A first (joined as an assignee, so it can be left), then B (newest, so the old default)
    a = await createWorkspace(owner.api, "Workspace A");
    expect((await user.api.post(`/api/workspaces/${a.$id}/join`, { data: { code: a.inviteCode } })).status()).toBe(200);
    b = await createWorkspace(user.api, "Workspace B");

    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
});

test.afterAll(async () => {
    // Requests cut off by logging out or leaving are expected to be refused
    const unexpected = errors.filter((error) => !/http (401|403):|status of (401|403)/.test(error));
    expect(unexpected, unexpected.join("\n")).toEqual([]);
    await page.close();
});

const homeLandsOn = async (workspaceId: string) => {
    // Leaving a workspace sends the app to / by itself; WebKit then reports our own visit as
    // interrupted by that one, so try once more
    await page.goto("/", { timeout: 90_000 }).catch(async (error: Error) => {
        if (!/interrupted by another navigation/.test(error.message)) throw error;
        await page.goto("/", { timeout: 90_000 });
    });
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}$`), { timeout: 60_000 });
};

test("/ reopens the workspace opened last", async () => {
    await page.goto(`/workspaces/${a.$id}`, { timeout: 90_000 });
    await homeLandsOn(a.$id);
    await page.goto(`/workspaces/${b.$id}/tasks`, { timeout: 90_000 });
    await homeLandsOn(b.$id);
    // The getting-started page isn't a workspace
    await page.goto("/workspaces/create", { timeout: 90_000 });
    await homeLandsOn(b.$id);
});

test("signing out and back in lands on the last workspace", async ({ baseURL }) => {
    await page.goto(`/workspaces/${a.$id}`, { timeout: 90_000 });
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/(sign-in|about)$/);
    await page.goto("/sign-in", { timeout: 90_000 });
    await page.getByPlaceholder("Enter email address").fill(user.email);
    await page.getByPlaceholder("Enter password").fill(user.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${a.$id}$`), { timeout: 60_000 });
    // Logging out ended the session the API context shared with the browser
    user = { ...user, ...(await userFromPage(page, baseURL!)) };
});

test("after leaving the last workspace, / falls back to the newest", async () => {
    await page.goto(`/workspaces/${a.$id}`, { timeout: 90_000 });
    const left = await user.api.post("/api/members/leave-workspace", { data: { workspaceId: a.$id } });
    expect(left.status(), await left.text()).toBe(200);
    await homeLandsOn(b.$id);
});
