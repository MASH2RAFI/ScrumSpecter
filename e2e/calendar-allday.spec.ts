import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, html5Drag, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: the Week view's all-day row makes all-day tasks (no start time or duration), which are
// drawn across the working day in the timeline; its headers say why a day is off
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
    // Drawn in the timeline across the working day (09:00 to 18:00: 9 hours of 44px rows at 30 min)
    const block = page.locator(".rbc-time-content .rbc-event:not(.rbc-addons-dnd-drag-preview)", { hasText: "Drop me all day" });
    await expect(block).toBeVisible();
    await expect(block).toContainText("All day");
    expect(Math.round((await block.boundingBox())!.height / 88)).toBe(9);
    await expect(page.locator(".rbc-allday-cell .rbc-event:not(.rbc-addons-dnd-drag-preview)", { hasText: "Drop me all day" })).toHaveCount(0);
});

test("an all-day block moved to another day stays all day", async ({ browserName }) => {
    // In Playwright's WebKit a drag inside the grid often never ends (the release doesn't reach the
    // calendar); dragging onto the bin works there. Not yet checked in real Safari: vault TODO §40
    test.fixme(browserName === "webkit", "grid drags don't reliably end in Playwright's WebKit");
    const block = page.locator(".rbc-time-content .rbc-event:not(.rbc-addons-dnd-drag-preview)", { hasText: "Drop me all day" });
    const before = (await taskNamed("Drop me all day")).dueDate!;
    const box = (await block.boundingBox())!;
    // Column 3 is kept free for the whole-day selection below
    const next = (await page.locator(".rbc-time-content .rbc-day-slot").nth(4).boundingBox())!;
    // Inside the card, below its title (as the timed-block test does), not on its top edge
    const y = box.y + 60;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, y, { steps: 3 });
    await page.mouse.move(next.x + next.width / 2, y, { steps: 10 });
    // A hand pauses before letting go; WebKit needs the moment to register the last move
    await page.waitForTimeout(300);
    await page.mouse.up();

    await expect.poll(async () => (await taskNamed("Drop me all day")).dueDate).not.toBe(before);
    const task = await taskNamed("Drop me all day");
    expect(task.startAt).toBeNull();
    expect(task.durationMinutes).toBeNull();
});

test("a timed block dragged to another day keeps its time and length", async ({ browserName }) => {
    test.fixme(browserName === "webkit", "grid drags don't reliably end in Playwright's WebKit (see the test above)");
    // Today 10:00–11:00 in Dhaka (the page's time zone), whatever the runner's own zone
    const dhaka = new Date(Date.now() + 6 * 3_600_000);
    const start = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate(), 4));
    const created = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Move my block", dueDate: start.toISOString(), startAt: start.toISOString(), durationMinutes: 60 });
    expect(created.status(), await created.text()).toBe(200);
    await page.reload();

    const block = page.locator(".rbc-time-content .rbc-event:not(.rbc-addons-dnd-drag-preview)", { hasText: "Move my block" });
    await expect(block).toBeVisible();
    const box = (await block.boundingBox())!;
    // Another day's column (the last, or the one before if the block is already there)
    const columns = page.locator(".rbc-time-content .rbc-day-slot");
    const last = (await columns.last().boundingBox())!;
    const target = box.x >= last.x ? (await columns.nth((await columns.count()) - 2).boundingBox())! : last;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, y, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, y, { steps: 10 });
    await page.waitForTimeout(300);
    await page.mouse.up();

    await expect.poll(async () => (await taskNamed("Move my block")).startAt).not.toBe(start.toISOString());
    const moved = await taskNamed("Move my block");
    // A whole number of days later or earlier, at the same time, still an hour long
    // (absolute value: dragged to an earlier day the remainder is -0, which toBe(0) refuses)
    expect(Math.abs(new Date(moved.startAt!).getTime() - start.getTime()) % 86_400_000).toBe(0);
    expect(moved.durationMinutes).toBe(60);
});

test("dragging across the all-day row creates an all-day task", async () => {
    await expect(allDayCell(1)).toBeVisible();
    await expect(allDayCell(3)).toBeVisible();
    // Measured together, again if the row was redrawn in between (the previous test's edit refreshes it)
    let from!: { x: number; y: number; width: number; height: number };
    let to!: { x: number; y: number; width: number; height: number };
    await expect(async () => {
        const first = await allDayCell(1).boundingBox();
        const third = await allDayCell(3).boundingBox();
        expect(first && third).toBeTruthy();
        from = first!;
        to = third!;
    }).toPass({ timeout: 10_000 });
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

test("selecting a whole day in the time slots keeps the task in the time slots", async ({ browserName }) => {
    // Same limit as the drags above: in Playwright's WebKit the selection often stops a slot short
    // (and in full runs, always); not yet checked in real Safari: vault TODO §40
    test.fixme(browserName === "webkit", "grid drags don't reliably end in Playwright's WebKit (see the tests above)");
    // Visible 20:00 to midnight, so one column is the whole visible day
    expect((await user.api.patch("/api/account/preferences", { data: { calendarStartHour: 20, calendarEndHour: 24 } })).status()).toBe(200);
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    const column = page.locator(".rbc-time-content .rbc-day-slot").nth(3);
    await expect(column).toBeVisible();
    const box = (await column.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 4, { steps: 10 });
    // WebKit sometimes ends the selection a slot short, or scrolls the page a little mid-drag, so
    // the column has moved: keep aiming at the column's live bottom edge until the highlighted
    // selection covers all of it, then release
    const x = box.x + box.width / 2;
    const lastSlot = column.locator(".rbc-time-slot").last();
    await expect(async () => {
        // The middle of the last slot, not the column's edge, which WebKit can hit-test as outside
        const slot = (await lastSlot.boundingBox())!;
        await page.mouse.move(x, slot.y + slot.height / 2, { steps: 4 });
        const live = (await column.boundingBox())!;
        const selection = await page.locator(".rbc-slot-selection").first().boundingBox();
        expect(selection?.height ?? 0).toBeGreaterThanOrEqual(live.height - 6);
    }).toPass({ timeout: 8_000 });
    await page.mouse.up();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByPlaceholder("Enter task name")).toBeVisible();
    await expect(dialog.getByLabel("All day")).not.toBeChecked();
    await dialog.getByPlaceholder("Enter task name").fill("Evening block");
    await dialog.getByRole("button", { name: "Assignees" }).click();
    await page.getByRole("listbox", { name: "Assignees" }).getByRole("option").first().click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("combobox").filter({ hasText: "Select project" }).click();
    await page.getByRole("option", { name: /Website/ }).click();
    await dialog.getByRole("button", { name: "Create Task" }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(async () => (await taskNamed("Evening block"))?.startAt ?? null).not.toBeNull();
    expect((await taskNamed("Evening block")).durationMinutes).toBe(240);
    // Ends at midnight, yet shows in the time slots, not the all-day row
    await expect(page.locator(".rbc-time-content .rbc-event", { hasText: "Evening block" })).toBeVisible();
    await expect(page.locator(".rbc-allday-cell .rbc-event", { hasText: "Evening block" })).toHaveCount(0);
    expect((await user.api.patch("/api/account/preferences", { data: { calendarStartHour: null, calendarEndHour: null } })).status()).toBe(200);
});

test("week headers label weekend days", async () => {
    // The workspace's weekend falls inside every week
    const weekend = page.locator(".rbc-time-header .holiday-label", { hasText: "Weekend" });
    await expect(weekend.first()).toBeVisible();
    await expect(weekend.first()).toHaveAttribute("title", "Weekend");
});
