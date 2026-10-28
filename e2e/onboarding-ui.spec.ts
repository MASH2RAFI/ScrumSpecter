import { expect, test, type Page } from "@playwright/test";

import { createProject, createWorkspace, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: the welcome tour a new account sees on first sign-in, worded for its role
test.describe.configure({ mode: "serial" });

let admin: TestUser, assignee: TestUser, viewer: TestUser;
let workspace: { $id: string; inviteCode: string };

const showTutorial = async (user: TestUser) =>
    (await (await user.api.get("/api/account")).json()).data.preferences.showTutorial as boolean;

const watched = async (page: Page, run: (errors: string[]) => Promise<void>) => {
    const errors = watchConsole(page);
    await run(errors);
    const unexpected = errors.filter((error) => !/http (401|403):|status of (401|403)/.test(error));
    expect(unexpected, unexpected.join("\n")).toEqual([]);
};

test.beforeAll(async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Tour Admin");
    assignee = await registerUser(baseURL!, "Tara Newcomer", { tutorial: true });
    viewer = await registerUser(baseURL!, "Vince Newcomer", { tutorial: true });
    workspace = await createWorkspace(admin.api, "Onboarding");
    await createProject(admin.api, workspace.$id, "Website", 14);
    await assignee.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } });
    const { viewerInviteCode } = (await (await admin.api.get(`/api/workspaces/${workspace.$id}`)).json()).data;
    await viewer.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: viewerInviteCode } });
});

test("existing accounts don't get the tour; new ones do", async () => {
    expect(await showTutorial(admin)).toBe(false);
    expect(await showTutorial(assignee)).toBe(true);
});

test("an assignee walks through the tour on first sign-in", async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await watched(page, async () => {
        await signInBrowser(page, assignee, baseURL!);
        await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });

        const tour = page.getByRole("dialog", { name: "Welcome to ScrumSpecter, Tara!" });
        await expect(tour).toContainText("You're an Assignee in Onboarding");
        await expect(tour).toContainText("Step 1 of 10");
        await expect(tour.getByRole("button", { name: "Show me around" })).toBeFocused();
        await tour.getByRole("button", { name: "Show me around" }).click();

        // Points at the sidebar's Home item, with the card beside it
        const card = page.getByRole("dialog", { name: "Home" });
        await expect(card).toContainText("Step 2 of 10");
        const home = page.locator('[data-tour="nav-home"]').first();
        await expect(home).toBeVisible();
        const [homeBox, cardBox] = [await home.boundingBox(), await card.boundingBox()];
        expect(cardBox!.x).toBeGreaterThan(homeBox!.x + homeBox!.width);

        // Arrow keys move through it; the assignee's wording explains the review step
        await page.keyboard.press("ArrowRight");
        await expect(page.getByRole("dialog", { name: "My Tasks" })).toContainText("up to In Review");
        // Page shortcuts don't fire underneath
        await page.keyboard.press("c");
        await expect(page.getByRole("dialog", { name: "My Tasks" })).toBeVisible();
        await page.keyboard.press("ArrowLeft");
        await expect(page.getByRole("dialog", { name: "Home" })).toBeVisible();

        for (const title of ["My Tasks", "Routines", "Requests", "Members", "Analytics", "Notifications", "Your account"]) {
            await page.getByRole("button", { name: "Next" }).click();
            await expect(page.getByRole("dialog", { name: title })).toBeVisible();
        }
        await page.getByRole("button", { name: "Next" }).click();
        const done = page.getByRole("dialog", { name: "You're all set" });
        await expect(done).toContainText("Step 10 of 10");
        await done.getByRole("button", { name: "Get started" }).click();
        await expect(page.getByTestId("welcome-tour")).toHaveCount(0);
        await expect.poll(() => showTutorial(assignee)).toBe(false);

        // Not again on the next visit (the browser cache is saved at most once a second)
        await page.waitForTimeout(1500);
        await page.reload();
        await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
        await page.waitForTimeout(1500);
        await expect(page.getByTestId("welcome-tour")).toHaveCount(0);

        // Replay from the quick-jump menu; Escape closes it
        await page.keyboard.press("Control+k");
        await page.getByRole("option", { name: /Take the tour/ }).click();
        await expect(page.getByRole("dialog", { name: "Welcome to ScrumSpecter, Tara!" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("welcome-tour")).toHaveCount(0);

        // And from the account menu
        await page.getByRole("button", { name: "Account menu" }).click();
        await page.getByRole("menuitem", { name: "Take the tour" }).click();
        await expect(page.getByRole("dialog", { name: "Welcome to ScrumSpecter, Tara!" })).toBeVisible();
        await page.getByRole("button", { name: "Close tour" }).click();
        await expect(page.getByTestId("welcome-tour")).toHaveCount(0);
    });
    await page.close();
});

test("a viewer on a phone gets a shorter tour, centred where the sidebar is hidden", async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await watched(page, async () => {
        await signInBrowser(page, viewer, baseURL!);
        await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });

        const tour = page.getByRole("dialog", { name: "Welcome to ScrumSpecter, Vince!" });
        await expect(tour).toContainText("You're a Viewer in Onboarding");
        // No Requests step for viewers
        await expect(tour).toContainText("Step 1 of 9");
        await tour.getByRole("button", { name: "Show me around" }).click();
        await page.getByRole("button", { name: "Next" }).click();

        const tasks = page.getByRole("dialog", { name: "My Tasks" });
        await expect(tasks).toContainText("not change it");
        const box = (await tasks.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(15);
        expect(box.x + box.width).toBeLessThanOrEqual(390 - 15);

        await tasks.getByRole("button", { name: "Close tour" }).click();
        await expect(page.getByTestId("welcome-tour")).toHaveCount(0);
        await expect.poll(() => showTutorial(viewer)).toBe(false);
    });
    await page.close();
});
