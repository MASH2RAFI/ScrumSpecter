import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, html5Drag, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: Jira-style calendar, routine week, edit-project popup, top bar, account settings, holidays, cache
test.describe.configure({ mode: "serial" });

let page: Page;
let errors: string[];
let user: TestUser;
let workspaceId: string;
let projectId: string;
let memberId: string;

const dhakaDay = (offsetDays = 0) => {
    const d = new Date(Date.now() + 6 * 3_600_000 + offsetDays * 86_400_000);
    return d.toISOString().slice(0, 10);
};
// Noon in Dhaka on that day, so the date is the same in UTC and Dhaka
const dhakaNoon = (offsetDays = 0) => `${dhakaDay(offsetDays)}T06:00:00.000Z`;

test.beforeAll(async ({ browser, baseURL }) => {
    user = await registerUser(baseURL!, "Calendar Cara");
    const workspace = await createWorkspace(user.api, "Calendar WS");
    workspaceId = workspace.$id;
    projectId = (await createProject(user.api, workspaceId, "Website", 21)).$id;
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

test("Members and Settings open as popups from the sidebar", async () => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    const sidebar = page.locator("aside, nav").filter({ has: page.getByRole("link", { name: "My Tasks" }) }).first();

    await sidebar.getByRole("button", { name: "Members" }).click();
    const members = page.getByRole("dialog", { name: "Members" });
    await expect(members.getByText("Calendar Cara")).toBeVisible();
    await expect(page).toHaveURL(/workspace-panel=members/);
    await page.keyboard.press("Escape");
    await expect(members).toBeHidden();

    await sidebar.getByRole("button", { name: "Settings" }).click();
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Holidays" }).click();
    await expect(settings.getByRole("heading", { name: "Holidays" })).toBeVisible();
    await expect(settings.getByRole("combobox", { name: "Public holidays" })).toContainText("Bangladesh");
    await page.keyboard.press("Escape");

    // No to-do or settings button in the top bar any more
    await expect(page.getByRole("button", { name: /^To do/ })).toHaveCount(0);

    // Old page links open the popups
    await page.goto(`/workspaces/${workspaceId}/settings`, { timeout: 90_000 });
    await expect(page.getByRole("dialog", { name: "Workspace settings" })).toBeVisible();
    await page.goto(`/workspaces/${workspaceId}/members`, { timeout: 90_000 });
    await expect(page.getByRole("dialog", { name: "Members" })).toBeVisible();
    await page.keyboard.press("Escape");
});

test("New workspace sits at the bottom of the workspace dropdown", async () => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    await page.mouse.move(30, 300);
    const sidebar = page.locator("aside[data-collapsed]").first();
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await sidebar.getByRole("combobox").click();
    const list = page.getByRole("listbox");
    await expect(list.getByRole("option", { name: /Calendar WS/ })).toBeVisible();
    // Below the workspaces, centred
    const option = (await list.getByRole("option").last().boundingBox())!;
    const button = page.getByRole("button", { name: "New workspace" });
    const box = (await button.boundingBox())!;
    const listBox = (await list.boundingBox())!;
    expect(box.y).toBeGreaterThan(option.y);
    expect(Math.abs(box.x + box.width / 2 - (listBox.x + listBox.width / 2))).toBeLessThan(4);
    await button.click();
    await expect(list).toBeHidden();
    await expect(page.getByRole("dialog").getByPlaceholder("Enter workspace name")).toBeVisible();
    await page.keyboard.press("Escape");
});

test("theme switch slides between light, system and dark", async () => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    const theme = page.getByRole("radiogroup", { name: "Theme" });
    await expect(theme.getByRole("radio", { name: "System theme" })).toHaveAttribute("aria-checked", "true");

    await theme.getByRole("radio", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(theme.getByRole("radio", { name: "Dark theme" })).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "System theme" }).click();
});

test("Edit project is a popup; the old settings URL opens it", async () => {
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`, { timeout: 90_000 });
    await page.getByRole("button", { name: "Edit Project" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByPlaceholder("Enter project name")).toHaveValue("Website");
    await dialog.getByPlaceholder("Enter project name").fill("Website v2");
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Website v2" })).toBeVisible();

    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`, { timeout: 90_000 });
    await expect(page).toHaveURL(new RegExp(`edit-project=${projectId}`));
    await expect(page.getByRole("dialog").getByPlaceholder("Enter project name")).toHaveValue("Website v2");
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/edit-project/);
});

test("routines: week overview starts on Saturday; Home and My Tasks show only this week", async () => {
    const res = await user.api.post("/api/routines", {
        data: { workspaceId, name: "Standup", projectId, assigneeIds: [memberId], weekdays: [1, 3, 6], startTime: "09:30", timeZone: "Asia/Dhaka", durationMinutes: 15 },
    });
    expect(res.status()).toBe(200);

    await page.goto(`/workspaces/${workspaceId}/routines`, { timeout: 90_000 });
    const week = page.getByLabel("Routines by weekday");
    await expect(week.locator("section").first()).toHaveAttribute("aria-label", "Saturday");
    for (const day of ["Monday", "Wednesday", "Saturday"]) {
        await expect(week.getByRole("region", { name: day }).getByText("Standup")).toBeVisible();
    }
    await expect(week.getByRole("region", { name: "Tuesday" }).getByText("Standup")).toHaveCount(0);
    // Hours down the side; the 9:30 routine sits between the 9 AM and 10 AM lines
    await expect(week.getByText("9 AM", { exact: true })).toBeVisible();
    const nine = (await week.getByText("9 AM", { exact: true }).boundingBox())!;
    const ten = (await week.getByText("10 AM", { exact: true }).boundingBox())!;
    const chip = (await week.getByRole("region", { name: "Monday" }).getByRole("button", { name: /Standup/ }).boundingBox())!;
    expect(chip.y).toBeGreaterThan(nine.y + nine.height / 2);
    expect(chip.y).toBeLessThan(ten.y + ten.height / 2);

    // Routine tasks exist for the whole 3-week sprint, but lists show only this week's
    const all = (await (await user.api.get(`/api/tasks?workspaceId=${workspaceId}&search=Standup`)).json()).data.documents as { dueDate: string }[];
    const weekStart = new Date(`${dhakaDay(-((new Date(Date.now() + 6 * 3_600_000).getUTCDay() + 1) % 7))}T00:00:00+06:00`);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
    const thisWeek = all.filter((t) => new Date(t.dueDate) >= weekStart && new Date(t.dueDate) < weekEnd).length;
    expect(all.length).toBeGreaterThan(thisWeek);

    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: /^(From a weekly routine )?Standup$/ })).toHaveCount(thisWeek);
    await expect(page.getByText(/routine tasks? \(done, or from other weeks\)/)).toBeVisible();

    // A finished routine task drops off the list too
    const [first] = all.filter((t) => new Date(t.dueDate) >= weekStart && new Date(t.dueDate) < weekEnd) as unknown as { $id: string }[];
    await user.api.patch(`/api/tasks/${first.$id}`, { data: { status: "DONE" } });
    await page.reload();
    await expect(page.getByRole("button", { name: /^(From a weekly routine )?Standup$/ })).toHaveCount(thisWeek - 1);
});

test("calendar: issue cards, +N more and the unscheduled panel", async () => {
    const busyDay = dhakaNoon(1);
    for (let i = 1; i <= 7; i++) {
        const created = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: `Busy ${i}`, dueDate: busyDay, storyPoints: i });
        expect(created.status()).toBe(200);
    }
    const unscheduled = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Someday task", dueDate: undefined });
    expect(unscheduled.status(), await unscheduled.text()).toBe(200);

    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=month`, { timeout: 90_000 });
    // Month cards: name and points (the project key shows on week/day blocks and in the panel)
    const card = page.locator(".rbc-month-view .issue-card", { hasText: "Busy 3" });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("title", /Busy 3 · Todo · Website v2/);
    await expect(card.getByText("3", { exact: true })).toBeVisible();

    const more = page.locator(".rbc-show-more").first();
    await expect(more).toBeVisible();
    await more.click();
    const dayList = page.getByRole("dialog", { name: /^Tasks on / });
    await expect(dayList).toBeVisible();
    // Grouped by project and status, collapsed: the header counts them
    // 7 busy tasks, plus the Standup routine when that day is one of its weekdays
    await expect(dayList.getByText(/^[78] tasks across 1 project$/)).toBeVisible();
    await dayList.getByRole("button", { name: "Close" }).click();

    const panel = page.getByRole("complementary", { name: "Unscheduled tasks" });
    await expect(panel.getByText("Someday task")).toBeVisible();
    await expect(panel.locator(".issue-card", { hasText: "Someday task" })).toContainText("WEB");

    // Drag it onto a month cell to schedule it
    const target = page.locator(`.rbc-day-bg[data-date="${dhakaDay(3)}"]`);
    // The event layer covers the day backgrounds; the drop finds the day under the pointer
    await html5Drag(page, panel.locator(".issue-card", { hasText: "Someday task" }), target);
    await expect(panel.getByText("Someday task")).toHaveCount(0);
    const scheduled = (await (await user.api.get(`/api/tasks?workspaceId=${workspaceId}&search=Someday`)).json()).data.documents[0];
    expect(scheduled.dueDate).not.toBeNull();
});

test("calendar: slot size and visible hours are user settings and persist", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    await page.getByRole("button", { name: "View settings" }).click();
    await expect(page.getByLabel("Slot size")).toHaveText("30m");
    await expect(page.getByRole("button", { name: "Smaller slots" })).toBeDisabled();
    await page.getByRole("button", { name: "Larger slots" }).click();
    await page.getByRole("button", { name: "Larger slots" }).click();
    await expect(page.getByLabel("Slot size")).toHaveText("1h 30m");

    await page.getByRole("combobox", { name: "From" }).click();
    await page.getByRole("option", { name: "8 AM" }).click();
    await page.getByRole("combobox", { name: "To" }).click();
    await page.getByRole("option", { name: "6 PM" }).click();
    await page.keyboard.press("Escape");

    const gutter = page.locator(".rbc-time-gutter .rbc-label");
    await expect(gutter.first()).toHaveText("8:00 AM");
    // 8 AM to 6 PM in 90-minute rows: 8:00, 9:30 ... 17:00
    await expect(gutter).toHaveCount(7);
    await expect(gutter.nth(1)).toHaveText("9:30 AM");

    await page.reload();
    await expect(page.locator(".rbc-time-gutter .rbc-label").first()).toHaveText("8:00 AM", { timeout: 30_000 });
    await expect(page.locator(".rbc-time-gutter .rbc-label")).toHaveCount(7);
});

test("calendar shows holidays", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=month`, { timeout: 90_000 });
    const target = new Date(2026, 11, 1);
    // Step forward month by month until December 2026
    for (let i = 0; i < 24; i++) {
        const heading = await page.getByRole("heading", { level: 2 }).filter({ hasText: /\d{4}$/ }).first().textContent();
        if (heading?.startsWith("December 2026")) break;
        await page.getByRole("button", { name: new Date() > target ? "Previous" : "Next" }).click();
    }
    await expect(page.locator(".holiday-label", { hasText: "Victory Day" })).toBeVisible();
    await expect(page.locator(".rbc-day-bg.rbc-holiday")).not.toHaveCount(0);
});

test("account settings: a page of its own; preferences change the week start and time format", async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Account settings" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Calendar Cara");
    // Notifications live in their own settings, not here
    await expect(page.getByRole("tab", { name: "notifications" })).toHaveCount(0);
    // Security lists the devices signed in to this account
    await page.getByRole("tab", { name: "security" }).click();
    const devices = page.getByRole("list", { name: "Signed-in devices" });
    await expect(devices.getByText("This device")).toBeVisible();
    // This test's session was created through the API, so its "device" is the test client
    await expect(devices.getByRole("listitem")).toHaveCount(1);
    await expect(devices.getByRole("button", { name: /^Log out/ })).toHaveCount(0);

    await page.getByRole("tab", { name: "preferences" }).click();
    await expect(page).toHaveURL(/\/account\?tab=preferences$/);
    await page.getByRole("combobox", { name: "Week starts on" }).click();
    await page.getByRole("option", { name: "Monday" }).click();
    await expect(page.getByText("Preferences saved")).toBeVisible();
    await page.getByRole("combobox", { name: "Time format" }).click();
    await page.getByRole("option", { name: /24-hour/ }).click();
    await expect(page.getByText("Preferences saved").first()).toBeVisible();

    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=month`, { timeout: 90_000 });
    await expect(page.locator(".rbc-month-header .rbc-header").first()).toHaveText("Mon");
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=week`);
    await expect(page.locator(".rbc-time-gutter .rbc-label").first()).toHaveText("08:00");
});

test("cached data renders on reload without refetching unchanged tasks", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Busy 1", exact: true })).toBeVisible();
    // Let the persister write
    await page.waitForTimeout(1500);

    const taskRequests: string[] = [];
    const listener = (url: string) => {
        if (/\/api\/tasks\?/.test(url)) taskRequests.push(url);
    };
    page.on("request", (req) => listener(req.url()));
    const versionCheck = page.waitForResponse((res) => res.url().includes("/api/workspaces/versions"));
    await page.reload();
    await expect(page.getByRole("button", { name: "Busy 1", exact: true })).toBeVisible();
    await versionCheck;
    await page.waitForTimeout(1000);
    expect(taskRequests).toEqual([]);

    // A change from somewhere else is picked up on the next check
    await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Made elsewhere", dueDate: dhakaNoon(0) });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: "Made elsewhere", exact: true })).toBeVisible();
    expect(taskRequests.length).toBeGreaterThanOrEqual(1);
});

test("My work: change a task's status in place", async () => {
    const created = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Status from home", dueDate: dhakaNoon(0) });
    const taskId = (await created.json()).data.$id;
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });

    await page.getByRole("button", { name: "Change status of Status from home (Todo)" }).click();
    await page.getByRole("menuitem", { name: "In Progress" }).click();
    await expect(page.getByRole("button", { name: "Change status of Status from home (In Progress)" })).toBeVisible();
    await expect.poll(async () => (await (await user.api.get(`/api/tasks/${taskId}`)).json()).data.status).toBe("IN_PROGRESS");

    // Done takes it off the list
    await page.getByRole("button", { name: "Change status of Status from home (In Progress)" }).click();
    await page.getByRole("menuitem", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Status from home", exact: true })).toHaveCount(0);
});

test("My work shows start–end times and a countdown to the end", async () => {
    const start = new Date(Date.now() - 15 * 60_000);
    start.setSeconds(0, 0);
    await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Timed now", dueDate: dhakaNoon(0), startAt: start.toISOString(), durationMinutes: 60 });
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });

    const row = page.locator("li", { has: page.getByRole("button", { name: /^Timed now/ }) });
    // An earlier test switched this account to 24-hour time
    await expect(row).toContainText(/\d{1,2}:\d{2}( [AP]M)? – \d{1,2}:\d{2}( [AP]M)?/);
    await expect(row.getByLabel("Time left")).toHaveText(/· 4[45]m left/);

    // Not started yet: counts down to the start
    const later = new Date(Date.now() + 2 * 3_600_000 + 5 * 60_000);
    later.setSeconds(0, 0);
    await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Later today", dueDate: dhakaNoon(0), startAt: later.toISOString(), durationMinutes: 30 });
    await page.reload();
    const laterRow = page.locator("li", { has: page.getByRole("button", { name: /^Later today/ }) });
    await expect(laterRow.getByLabel("Time to start")).toHaveText(/· starts in 2h( [45]m)?/);
});

test("bell: reminders list, test notification and settings", async () => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    // Notification settings open from the bell
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await page.getByRole("button", { name: "Notification settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Notification settings" });
    await expect(dialog.getByText("At 6 PM the day before")).toBeVisible();
    await expect(dialog.getByText("Times are in Asia/Dhaka.")).toBeVisible();
    await dialog.getByRole("button", { name: "Send a test" }).click();
    await expect(page.getByText(/Added to the bell|Test sent/)).toBeVisible();
    await page.keyboard.press("Escape");

    const bell = page.getByRole("button", { name: /^Notifications, 1 unread$/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByRole("list", { name: "Reminders" }).getByText("Notifications are working")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
});

test("logout removes the cached copy", async () => {
    expect(await page.evaluate(() => localStorage.getItem("scrumspecter-cache"))).not.toBeNull();
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/about$/);
    expect(await page.evaluate(() => localStorage.getItem("scrumspecter-cache"))).toBeNull();
});
