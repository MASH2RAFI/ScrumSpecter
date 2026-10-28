import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { createTask, getMembers, userFromPage, watchConsole } from "./helpers";

// Browser regression: public pages, sign-up/sign-in, workspace setup and the main task views.
test.describe.configure({ mode: "serial" });

let page: Page;
let errors: string[];
let user: { cookie: string; api: APIRequestContext };
let workspaceId: string;
let projectId: string;
let memberId: string;

const email = `e2e-ui-${Date.now().toString(36)}@example.com`;
const password = "correct-horse-battery";

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dhaka" });
    errors = watchConsole(page);
});

test.afterAll(async () => {
    await page.close();
});

test.afterEach(() => {
    // Every step must finish without console errors or uncaught exceptions
    expect(errors, errors.join("\n")).toEqual([]);
});

test("visitors are sent to the about page; legal pages are public", async () => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/about$/);
    for (const path of ["/privacy", "/terms", "/sign-in", "/sign-up"]) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(200);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
});

test("sign up leads to workspace creation", async () => {
    await page.goto("/sign-up");
    await page.getByPlaceholder("Enter your name").fill("UI Tester");
    await page.getByPlaceholder("Enter email address").fill(email);
    await page.getByPlaceholder("Enter password").fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/workspaces\/create$/);
});

test("create a workspace with its first project", async () => {
    await page.getByPlaceholder("Enter workspace name").fill("UI Workspace");
    await page.getByPlaceholder("Enter project name").fill("Website");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    // Lands on the new project's board
    // The dev server compiles the dashboard on first visit, which can take a while
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/projects\/[^/]+$/, { timeout: 60_000 });
    [, workspaceId, projectId] = page.url().match(/\/workspaces\/([^/]+)\/projects\/([^/]+)$/)!;
    // A new account is greeted by the welcome tour (walked through in onboarding-ui.spec.ts)
    const tour = page.getByRole("dialog", { name: "Welcome to ScrumSpecter, UI!" });
    await expect(tour).toContainText("You're an Admin in UI Workspace");
    await tour.getByRole("button", { name: "Skip tour" }).click();
    await expect(page.getByTestId("welcome-tour")).toHaveCount(0);
    // In the page itself (the folded sidebar also lists it, faded out)
    await expect(page.getByRole("main").getByText("Website").first()).toBeVisible();
});

test("sign out and back in", async ({ baseURL }) => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/(sign-in|about)$/);
    expect((await page.context().cookies()).some((c) => c.name === "specter-session")).toBe(false);
    await page.goto("/sign-in");
    await page.getByPlaceholder("Enter email address").fill(email);
    await page.getByPlaceholder("Enter password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}$`));
    // Skipping the tour is remembered on the account
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("welcome-tour")).toHaveCount(0);

    // Seed tasks through the API as this user
    user = await userFromPage(page, baseURL!);

    memberId = (await getMembers(user.api, workspaceId))[0].$id;

    // Today at the given hour in the page's timezone (Dhaka, UTC+6, no DST)
    const dhaka = new Date(Date.now() + 6 * 3_600_000);
    const at = (hours: number) => new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate(), hours - 6)).toISOString();
    for (const [name, status, startAt, durationMinutes] of [
        ["Design homepage", "TODO", at(10), 60],
        ["Fix login bug", "IN_PROGRESS", null, null],
        ["Write release notes", "DONE", null, null],
    ] as const) {
        const created = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name, status, startAt, durationMinutes });
        expect(created.status(), await created.text()).toBe(200);
    }
});

test("home shows my work", async () => {
    await page.goto(`/workspaces/${workspaceId}`);
    await expect(page.getByText("Design homepage").first()).toBeVisible();
});

test("a workspace you can't open leads to your own, not to workspace creation", async () => {
    await page.goto("/workspaces/6c15b841-0000-4000-8000-000000000000");
    // The toast first: it only stays a few seconds, and a slow redirect could outlast it
    await expect(page.getByText("That page isn't available to you")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}$`), { timeout: 30_000 });
    // The refused requests themselves are expected here
    errors.splice(0, errors.length, ...errors.filter((error) => !/http (401|403|404):|status of (401|403|404)/.test(error)));
});

test("task table lists tasks and search filters them", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks`);
    await expect(page.getByRole("cell", { name: "Fix login bug", exact: true })).toBeVisible();
    await page.getByPlaceholder("Search tasks...").fill("release");
    await expect(page.getByRole("cell", { name: "Write release notes", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Fix login bug", exact: true })).toHaveCount(0);
    await page.getByPlaceholder("Search tasks...").fill("");
    await expect(page.getByRole("cell", { name: "Fix login bug", exact: true })).toBeVisible();
});

test("clicking a task opens the side panel", async () => {
    await page.getByRole("button", { name: "Fix login bug", exact: true }).click();
    await expect(page).toHaveURL(/[?&]task=/);
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Fix login bug").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]task=/);
});

test("kanban shows each status column", async () => {
    await page.getByRole("tab", { name: "Kanban" }).click();
    for (const name of ["Design homepage", "Fix login bug", "Write release notes"]) {
        await expect(page.getByText(name).first()).toBeVisible();
    }
});

test("calendar week view shows the timed task as a block", async () => {
    await page.getByRole("tab", { name: "Calendar" }).click();
    await expect(page.locator(".rbc-month-view")).toBeVisible();
    await page.getByRole("button", { name: "week", exact: true }).click();
    await expect(page.locator(".rbc-time-view")).toBeVisible();
    await expect(page.locator(".rbc-time-content .rbc-event", { hasText: "Design homepage" })).toBeVisible();
    await page.getByRole("button", { name: "day", exact: true }).click();
    await expect(page.locator(".rbc-time-content .rbc-event", { hasText: "Design homepage" })).toBeVisible();
});

test("create a timed task from the new-task form", async () => {
    await page.getByRole("tab", { name: "Table" }).click();
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Enter task name").fill("Sprint review");
    await dialog.getByRole("button", { name: "Assignees" }).click();
    await page.getByRole("listbox", { name: "Assignees" }).getByRole("option").first().click();
    // The list stays open for more picks; Escape closes just the list
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox", { name: "Assignees" })).toBeHidden();
    await dialog.getByRole("combobox").filter({ hasText: "Select project" }).click();
    await page.getByRole("option", { name: /Website/ }).click();
    await dialog.getByLabel("All day").click();
    await dialog.getByLabel("Start time").fill("14:00");
    // 15m · 30m · 1h · 1.5h · 2h · 3h · ½ day
    await expect(dialog.getByRole("group", { name: "Duration" }).getByRole("button")).toHaveText(["15m", "30m", "1h", "1.5h", "2h", "3h", "½ day"]);
    await dialog.getByRole("button", { name: "1h", exact: true }).click();
    await dialog.getByRole("button", { name: "Create Task" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("cell", { name: "Sprint review", exact: true })).toBeVisible();

    const tasks = (await (await user.api.get(`/api/tasks?workspaceId=${workspaceId}&search=Sprint review`)).json()).data.documents;
    // 14:00 in Dhaka is 08:00 UTC
    expect(new Date(tasks[0].startAt).getUTCHours()).toBe(8);
    expect(tasks[0].durationMinutes).toBe(60);
});

test("command palette jumps to a project", async () => {
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder("Jump to a page, project or task...");
    await expect(input).toBeVisible();
    await input.fill("Website");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
});

test("sidebar auto-hides: opens on hover, holds 0.3 seconds, pins with [", async () => {
    const panel = page.locator("aside[data-collapsed]").first();
    const frame = panel.locator("xpath=../..");
    await page.mouse.move(900, 400);
    await expect(panel).toHaveAttribute("data-collapsed", "true", { timeout: 5_000 });
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(76);

    await page.mouse.move(30, 300);
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await expect.poll(async () => (await frame.boundingBox())?.width).toBe(264);

    // Held open for 0.3 seconds after the pointer leaves, then folded
    await page.mouse.move(900, 400);
    expect(await panel.getAttribute("data-collapsed")).toBe("false");
    await expect(panel).toHaveAttribute("data-collapsed", "true", { timeout: 2_000 });

    // Its workspace dropdown renders outside it: the sidebar stays open while the list is open
    await page.mouse.move(30, 300);
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await panel.getByRole("combobox").click();
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible();
    await option.hover();
    await page.waitForTimeout(800);
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await expect(option).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.move(900, 400);
    await expect(panel).toHaveAttribute("data-collapsed", "true", { timeout: 2_000 });

    // [ pins it open; again goes back to auto-hide
    await page.keyboard.press("[");
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await page.mouse.move(900, 450);
    await page.waitForTimeout(1_000);
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await page.keyboard.press("[");
    await expect(panel).toHaveAttribute("data-collapsed", "true");

    // Switching to another window sends no mouseleave; losing focus folds it instead
    await page.mouse.move(30, 300);
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(panel).toHaveAttribute("data-collapsed", "true");
    // Back in the window, moving the pointer over it opens it again
    await page.mouse.move(40, 320);
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await page.mouse.move(900, 400);
    await expect(panel).toHaveAttribute("data-collapsed", "true", { timeout: 2_000 });
});

test("every workspace page renders", async () => {
    for (const path of ["", "/tasks", "/routines", "/members", "/analytics", "/settings", `/projects/${projectId}`, `/projects/${projectId}/settings`]) {
        const res = await page.goto(`/workspaces/${workspaceId}${path}`);
        expect(res?.status(), path).toBe(200);
        await expect(page.locator("main, body").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
    }
});

test("dark theme renders the calendar without errors", async () => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar`);
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ colorScheme: "light" });
});
