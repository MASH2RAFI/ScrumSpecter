import { expect, test, type Locator, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, type TestUser } from "./helpers";

// Keyboard only: the main paths work without a mouse, dialogs keep focus inside and give it back
test.describe.configure({ mode: "serial" });

let user: TestUser;
let workspaceId: string;

const isFocused = (locator: Locator) => locator.evaluate((el) => el === document.activeElement);

// Presses Tab until `target` has focus, as a keyboard user would reach it
const tabTo = async (page: Page, target: Locator, max = 80) => {
    for (let i = 0; i < max; i++) {
        if (await isFocused(target)) return;
        await page.keyboard.press("Tab");
    }
    throw new Error(`Tab never reached ${target}`);
};

test.beforeAll(async ({ baseURL }) => {
    user = await registerUser(baseURL!, "Kim Keys");
    workspaceId = (await createWorkspace(user.api, "Keys WS")).$id;
    const projectId = (await createProject(user.api, workspaceId, "Launch")).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Keyboard task", status: "TODO", startAt: today.toISOString(), dueDate: today.toISOString(), durationMinutes: 60 });
});

test.beforeEach(async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInBrowser(page, user, baseURL!);
});

test("the sidebar is reachable and opens while focused", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    const myTasks = page.locator("aside").getByRole("link", { name: "My Tasks" });
    await tabTo(page, myTasks);
    // Focus inside unfolds it, so the focused link is visible (WCAG 2.4.11)
    await expect(page.locator("aside[data-collapsed]").first()).toHaveAttribute("data-collapsed", "false");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tasks/);
});

test("the quick-jump menu works with arrows and Enter", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    await page.keyboard.press("Control+k");
    await page.keyboard.type("Launch");
    await expect(page.getByRole("option", { name: /Launch/ }).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/projects\//);
});

test("a dialog keeps focus inside and gives it back on Escape", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    const newTask = page.getByRole("button", { name: /^New/ }).first();
    await tabTo(page, newTask);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(newTask).toBeFocused();
});

test("a task opens from the table and Escape returns to it", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    const name = page.getByRole("button", { name: "Keyboard task", exact: true });
    await tabTo(page, name);
    await page.keyboard.press("Enter");
    const panel = page.getByRole("dialog", { name: "Keyboard task" });
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(name).toBeFocused();
});

test("a Kanban card moves to the next column with Space and the arrow keys", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=kanban`, { timeout: 90_000 });
    const card = page.locator("[data-rfd-draggable-id]").filter({ hasText: "Keyboard task" });
    await tabTo(page, card, 120);
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.press("Space");
    await expect.poll(async () => {
        const tasks = (await (await user.api.get(`/api/tasks?workspaceId=${workspaceId}`)).json()).data.documents;
        return tasks.find((task: { name: string }) => task.name === "Keyboard task").status;
    }).toBe("IN_PROGRESS");
});

test("the calendar moves between weeks and opens a task from the keyboard", async ({ page }) => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    const event = page.locator(".rbc-time-content .rbc-event").filter({ hasText: "Keyboard task" });
    await expect(event).toBeVisible();

    const next = page.getByRole("button", { name: "Next" });
    await tabTo(page, next);
    await page.keyboard.press("Enter");
    await expect(event).toHaveCount(0);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(event).toBeVisible();

    await tabTo(page, event, 150);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Keyboard task" })).toBeVisible();
});
