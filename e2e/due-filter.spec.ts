import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// The My Tasks due filter matches the whole picked day in the viewer's time zone, whatever
// instant a task was saved at (local midnight from the picker, 12:00 UTC for routines)
test.describe.configure({ mode: "serial" });

let user: TestUser;
let workspaceId: string;

// Today in Dhaka (UTC+6, no DST), the time zone the page runs in below
const day = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
const dhakaMidnight = (date: string, addDays = 0) => new Date(Date.parse(`${date}T00:00:00+06:00`) + addDays * 86_400_000).toISOString();

test.beforeAll(async ({ baseURL }) => {
    user = await registerUser(baseURL!, "Due Dee");
    workspaceId = (await createWorkspace(user.api, "Due dates")).$id;
    const projectId = (await createProject(user.api, workspaceId, "Ops", 14)).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;

    for (const [name, dueDate] of [["Midnight task", dhakaMidnight(day)], ["Next day task", dhakaMidnight(day, 1)]] as const) {
        const res = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name, dueDate });
        expect(res.status(), await res.text()).toBe(200);
    }
    // Every day, so it has a task on `day` at 12:00 UTC
    const routine = await user.api.post("/api/routines", {
        data: { workspaceId, name: "Standup", projectId, assigneeIds: [memberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect(routine.status(), await routine.text()).toBe(200);
});

test("API: a from/to day filter matches local midnight and 12:00 UTC on that day", async () => {
    const query = new URLSearchParams({ workspaceId, from: dhakaMidnight(day), to: dhakaMidnight(day, 1) });
    const res = await user.api.get(`/api/tasks?${query}`);
    expect(res.status(), await res.text()).toBe(200);
    const documents = (await res.json()).data.documents as { name: string; dueDate: string }[];
    expect(documents.map((t) => t.name).sort()).toEqual(["Midnight task", "Standup"]);
    expect(documents.find((t) => t.name === "Standup")!.dueDate).toBe(`${day}T12:00:00.000Z`);
});

test("phone: pick a day in the filters, then clear it", async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "Asia/Dhaka" });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    const main = page.getByRole("main");
    await expect(main.getByText("Next day task")).toBeVisible();

    await page.getByRole("button", { name: "Filters" }).click();
    const picker = page.getByLabel("Due date", { exact: true });
    // The empty field shows its placeholder (iOS shows nothing of its own)
    await expect(page.locator("#task-filters").getByText("Due date", { exact: true })).toBeVisible();
    await picker.fill(day);
    await expect(page).toHaveURL(/dueDate=/);
    await expect(main.getByText("Midnight task")).toBeVisible();
    await expect(main.getByText("Standup")).toHaveCount(1);
    await expect(main.getByText("Next day task")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear date" }).click();
    await expect(page).not.toHaveURL(/dueDate=/);
    await expect(main.getByText("Next day task")).toBeVisible();
    await expect(picker).toHaveValue("");
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});
