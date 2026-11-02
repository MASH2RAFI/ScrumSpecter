import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Account preferences: calendar defaults, the Routines page's project eyes, and retiming a routine
test.describe.configure({ mode: "serial" });

let user: TestUser;
let workspaceId: string;
let memberId: string;
let page: Page;

test.beforeAll(async ({ baseURL, browser }) => {
    user = await registerUser(baseURL!, "Petra Prefs");
    workspaceId = (await createWorkspace(user.api, "Preferences")).$id;
    memberId = (await getMembers(user.api, workspaceId))[0].$id;
    page = await browser.newPage();
    watchConsole(page);
    await signInBrowser(page, user, baseURL!);
});

test.afterAll(async () => {
    await page.close();
});

test("invalid calendar preferences are rejected", async () => {
    expect((await user.api.patch("/api/account/preferences", { data: { calendarView: "year" } })).status()).toBe(400);
    expect((await user.api.patch("/api/account/preferences", { data: { calendarSlotMinutes: 45 } })).status()).toBe(400);
    expect((await user.api.patch("/api/account/preferences", { data: { calendarEndHour: 25 } })).status()).toBe(400);
});

test("the calendar opens in the saved default view", async () => {
    const res = await user.api.patch("/api/account/preferences", { data: { calendarView: "week", calendarShowUnscheduled: false } });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).data).toMatchObject({ calendarView: "week", calendarShowUnscheduled: false, calendarStartHour: null });

    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar`, { timeout: 90_000 });
    await expect(page.getByRole("group", { name: "Calendar view" }).getByRole("button", { name: "week" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".rbc-time-view")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Unscheduled tasks" })).toHaveCount(0);

    // The URL still wins
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=month`, { timeout: 90_000 });
    await expect(page.locator(".rbc-month-view")).toBeVisible();
});

test("a project's eye on Routines hides its routines, and stays hidden", async () => {
    const ops = await createProject(user.api, workspaceId, "Ops", 14);
    const web = await createProject(user.api, workspaceId, "Web", 14);
    for (const [name, projectId] of [["Ops standup", ops.$id], ["Web review", web.$id]]) {
        const res = await user.api.post("/api/routines", {
            data: { workspaceId, name, projectId, assigneeIds: [memberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
        });
        expect(res.status(), await res.text()).toBe(200);
    }

    await page.goto(`/workspaces/${workspaceId}/routines`, { timeout: 90_000 });
    const list = page.locator("main");
    await expect(list.getByText("Ops standup").first()).toBeVisible();
    await page.getByRole("button", { name: "Hide Ops from Routines" }).click();
    await expect(list.getByText("Ops standup")).toHaveCount(0);
    await expect(list.getByText("Web review").first()).toBeVisible();

    await expect.poll(async () => (await (await user.api.get("/api/account")).json()).data.preferences.hiddenRoutineProjects).toEqual([ops.$id]);
    // My Tasks' own list is untouched
    expect((await (await user.api.get("/api/account")).json()).data.preferences.hiddenProjects).toEqual([]);

    await page.reload();
    await expect(list.getByText("Web review").first()).toBeVisible();
    await expect(list.getByText("Ops standup")).toHaveCount(0);

    await page.getByRole("button", { name: "Show Ops in Routines" }).click();
    await expect(list.getByText("Ops standup").first()).toBeVisible();
});

test("retiming a routine moves its upcoming To Do tasks only", async () => {
    const project = await createProject(user.api, workspaceId, "Retime", 14);
    const res = await user.api.post("/api/routines", {
        data: {
            workspaceId, name: "Retime check", projectId: project.$id, assigneeIds: [memberId],
            weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: "09:00", timeZone: "Asia/Dhaka", durationMinutes: 15,
        },
    });
    expect(res.status(), await res.text()).toBe(200);
    const routine = (await res.json()).data;

    const list = async () => (await (await user.api.get(`/api/tasks?workspaceId=${workspaceId}&search=Retime check`)).json())
        .data.documents as { $id: string; status: string; startAt: string | null; durationMinutes: number | null }[];
    const tasks = await list();
    expect(tasks).toHaveLength(14);

    // Work already started keeps its time
    const started = tasks[0];
    expect((await user.api.patch(`/api/tasks/${started.$id}`, { data: { status: "IN_PROGRESS" } })).status()).toBe(200);

    expect((await user.api.patch(`/api/routines/${routine.$id}`, { data: { startTime: "10:30", durationMinutes: 45 } })).status()).toBe(200);
    const retimed = await list();
    expect(retimed).toHaveLength(14);
    for (const task of retimed) {
        if (task.$id === started.$id) {
            expect(task.startAt).toBe(started.startAt);
            expect(task.durationMinutes).toBe(15);
            continue;
        }
        // 10:30 in Dhaka (UTC+6) is 04:30 UTC
        const startAt = new Date(task.startAt!);
        expect([startAt.getUTCHours(), startAt.getUTCMinutes()]).toEqual([4, 30]);
        expect(task.durationMinutes).toBe(45);
    }

    // All day: times and lengths cleared
    expect((await user.api.patch(`/api/routines/${routine.$id}`, { data: { startTime: null, durationMinutes: null } })).status()).toBe(200);
    const allDay = (await list()).filter((task) => task.$id !== started.$id);
    expect(allDay.every((task) => task.startAt === null && task.durationMinutes === null)).toBe(true);
});

test("saves sent at the same moment don't overwrite each other", async () => {
    const save = (data: Record<string, unknown>) => user.api.patch("/api/account/preferences", { data });
    const results = await Promise.all([
        save({ calendarView: "week" }),
        save({ landingPage: "my-tasks" }),
        save({ weekStart: 1 }),
        save({ timeFormat: "24h" }),
    ]);
    for (const res of results) expect(res.status(), await res.text()).toBe(200);
    const prefs = (await (await user.api.get("/api/account")).json()).data.preferences;
    expect(prefs).toMatchObject({ calendarView: "week", landingPage: "my-tasks", weekStart: 1, timeFormat: "24h" });
});

test("date format, My Tasks defaults and Kanban options follow the account", async () => {
    const projectId = (await createProject(user.api, workspaceId, "Defaults")).$id;
    const due = new Date(2027, 2, 9, 12).toISOString();
    for (const [name, status, storyPoints] of [["Bravo", "TODO", 1], ["Alpha", "TODO", 8], ["Finished", "DONE", 2]] as const) {
        expect((await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name, status, storyPoints, dueDate: due })).status()).toBe(200);
    }
    expect((await user.api.patch("/api/account/preferences", { data: { dateFormat: "longest" } })).status()).toBe(400);
    const res = await user.api.patch("/api/account/preferences", {
        data: { dateFormat: "iso", taskSort: "name", showDoneInTable: false, kanbanCompact: true, kanbanShrinkEmpty: true },
    });
    expect(res.status(), await res.text()).toBe(200);

    // Table: A to Z, Done left out, ISO dates
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table&projectId=${projectId}`, { timeout: 90_000 });
    const names = page.locator("tbody tr").getByRole("button", { name: /^(Alpha|Bravo|Finished)$/ });
    await expect(names).toHaveText(["Alpha", "Bravo"]);
    await expect(page.locator("tbody").getByText("2027-03-09").first()).toBeVisible();
    // A status filter still shows Done
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table&projectId=${projectId}&status=DONE`, { timeout: 90_000 });
    await expect(names).toHaveText(["Finished"]);

    // Kanban: compact cards (no project line), empty columns narrowed
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=kanban&projectId=${projectId}`, { timeout: 90_000 });
    const card = page.locator("[data-rfd-draggable-id]").filter({ hasText: "Alpha" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Defaults")).toHaveCount(0);
    const width = async (id: string) => (await page.locator(`[data-rfd-droppable-id="${id}"]`).boundingBox())!.width;
    expect(await width("IN_REVIEW")).toBeLessThan(await width("TODO") / 1.5);
});
