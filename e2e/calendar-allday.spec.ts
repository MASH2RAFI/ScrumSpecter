import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, html5Drag, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: the Week view's all-day row makes all-day tasks (no start time or duration),
// and its headers say why a day is off
test.describe.configure({ mode: "serial" });

let page: Page;
let errors: string[];
let user: TestUser;
let workspaceId: string;
let projectId: string;
let memberId: string;

const taskNamed = async (name: string) =>
    (await (await user.api.get(`/api/tasks?workspaceId=${workspaceId}&search=${encodeURIComponent(name)}`)).json())
        .data.documents.find((t: { name: string }) => t.name === name) as { dueDate: string | null; startAt: string | null; durationMinutes: number | null };

const allDayCell = (index: number) => page.locator(".rbc-time-header .rbc-allday-cell .rbc-day-bg").nth(index);

test.beforeAll(async ({ browser, baseURL }) => {
    user = await registerUser(baseURL!, "Allday Alif");
    workspaceId = (await createWorkspace(user.api, "All-day WS")).$id;
    projectId = (await createProject(user.api, workspaceId, "Website", 14)).$id;
    memberId = (await getMembers(user.api, workspaceId))[0].$id;

    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Dhaka" });
    errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
});

test.afterAll(async () => {
    await page.close();
});

test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
});

test("an unscheduled task dropped on the all-day row stays all day", async () => {
    const created = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Drop me all day", dueDate: undefined });
    expect(created.status(), await created.text()).toBe(200);

    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    const panel = page.getByRole("complementary", { name: "Unscheduled tasks" });
    const card = panel.locator(".issue-card", { hasText: "Drop me all day" });
    await expect(card).toBeVisible();
    await expect(allDayCell(2)).toBeVisible();
    await html5Drag(page, card, allDayCell(2));
    await expect(panel.getByText("Drop me all day")).toHaveCount(0);

    await expect.poll(async () => (await taskNamed("Drop me all day")).dueDate).not.toBeNull();
    const task = await taskNamed("Drop me all day");
    expect(task.startAt).toBeNull();
    expect(task.durationMinutes).toBeNull();
    await expect(page.locator(".rbc-allday-cell .rbc-event:not(.rbc-addons-dnd-drag-preview)", { hasText: "Drop me all day" })).toBeVisible();
});

test("dragging across the all-day row creates an all-day task", async () => {
    await expect(allDayCell(1)).toBeVisible();
    const from = (await allDayCell(1).boundingBox())!;
    const to = (await allDayCell(3).boundingBox())!;
    // Below the events, on the row's background
    const y = from.y + from.height - 3;
    await page.mouse.move(from.x + from.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, y, { steps: 8 });
    await page.mouse.up();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByPlaceholder("Enter task name")).toBeVisible();
    await expect(dialog.getByLabel("All day")).toBeChecked();
    await dialog.getByPlaceholder("Enter task name").fill("Dragged all day");
    await dialog.getByRole("button", { name: "Assignees" }).click();
    await page.getByRole("listbox", { name: "Assignees" }).getByRole("option").first().click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("combobox").filter({ hasText: "Select project" }).click();
    await page.getByRole("option", { name: /Website/ }).click();
    await expect(dialog.getByRole("combobox").filter({ hasText: "Website" })).toBeVisible();
    await dialog.getByRole("button", { name: "Create Task" }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(async () => (await taskNamed("Dragged all day"))?.dueDate ?? null).not.toBeNull();
    const task = await taskNamed("Dragged all day");
    expect(task.startAt).toBeNull();
    expect(task.durationMinutes).toBeNull();
});

test("week headers label weekend days", async () => {
    // The workspace's weekend falls inside every week
    const weekend = page.locator(".rbc-time-header .holiday-label", { hasText: "Weekend" });
    await expect(weekend.first()).toBeVisible();
    await expect(weekend.first()).toHaveAttribute("title", "Weekend");
});
