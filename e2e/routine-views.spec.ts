import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Each routine chooses the task views (table, kanban, calendar) its tasks appear in
test.describe.configure({ mode: "serial" });

let admin: TestUser;
let workspaceId: string;
let projectId: string;
let memberId: string;
let routineId: string;

test.beforeAll(async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Rory Routines");
    workspaceId = (await createWorkspace(admin.api, "Routine views")).$id;
    projectId = (await createProject(admin.api, workspaceId, "Ops", 14)).$id;
    memberId = (await getMembers(admin.api, workspaceId))[0].$id;
});

test("routines show everywhere by default; the API stores each view's setting", async () => {
    const res = await admin.api.post("/api/routines", {
        data: { workspaceId, name: "Standup", projectId, assigneeIds: [memberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect(res.status(), await res.text()).toBe(200);
    const routine = (await res.json()).data;
    expect(routine).toMatchObject({ showInTable: true, showInKanban: true, showInCalendar: true });
    routineId = routine.$id;

    const updated = await admin.api.patch(`/api/routines/${routineId}`, { data: { showInKanban: false } });
    expect((await updated.json()).data).toMatchObject({ showInTable: true, showInKanban: false, showInCalendar: true });
    expect((await admin.api.patch(`/api/routines/${routineId}`, { data: { showInKanban: "no" } })).status()).toBe(400);
});

test("bulk input: show: picks the views", async () => {
    const run = async (script: string) => (await admin.api.post(`/api/workspaces/${workspaceId}/bulk`, { data: { script, apply: true } })).json();
    const ok = await run(`routine add "Report" project:"Ops" days:mon show:calendar`);
    expect(ok.data.applied, JSON.stringify(ok)).toBe(true);
    const bad = await run(`routine add "Typo" project:"Ops" days:mon show:kanbn`);
    expect(bad.data.results[0].error).toMatch(/isn't a view/);

    const routines = (await (await admin.api.get(`/api/routines?workspaceId=${workspaceId}`)).json()).data.documents;
    expect(routines.find((r: { name: string }) => r.name === "Report")).toMatchObject({ showInTable: false, showInKanban: false, showInCalendar: true });
});

test("the views follow the routine's settings", async ({ browser, baseURL }) => {
    // Just Standup from here on
    const routines = (await (await admin.api.get(`/api/routines?workspaceId=${workspaceId}`)).json()).data.documents;
    for (const routine of routines.filter((r: { $id: string }) => r.$id !== routineId)) {
        expect((await admin.api.delete(`/api/routines/${routine.$id}`)).status()).toBe(200);
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, admin, baseURL!);
    const standup = /^(From a weekly routine )?Standup$/;

    // Standup: table and calendar, not kanban
    await page.goto(`/workspaces/${workspaceId}/tasks`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: standup }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Kanban" }).click();
    await expect(page.getByRole("tab", { name: "Kanban" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Standup", { exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Calendar" }).click();
    await page.getByRole("button", { name: "week", exact: true }).click();
    await expect(page.locator(".rbc-calendar").getByText("Standup").first()).toBeVisible();

    // The routine's card shows and changes the setting directly (not in the edit form)
    await page.goto(`/workspaces/${workspaceId}/routines`, { timeout: 90_000 });
    const views = page.getByRole("group", { name: "Show Standup's tasks in" });
    await expect(views.getByRole("button", { name: "Kanban" })).toHaveAttribute("aria-pressed", "false");
    await expect(views.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
    await views.getByRole("button", { name: "Table" }).click();
    await expect(views.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByText("Show its tasks in")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto(`/workspaces/${workspaceId}/tasks`, { timeout: 90_000 });
    await expect(page.getByRole("tab", { name: "Table" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: standup })).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

test("My Tasks: the eye beside a project hides its tasks there", async ({ browser, baseURL }) => {
    const res = await admin.api.post("/api/projects", { multipart: { name: "Marketing", workspaceId } });
    const marketingId = (await res.json()).data.$id;
    await admin.api.post("/api/tasks", { data: { workspaceId, projectId: marketingId, assigneeIds: [memberId], name: "Launch post", status: "TODO", dueDate: new Date().toISOString() } });

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Launch post", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Hide Marketing from My Tasks" }).click();
    await expect(page.getByRole("button", { name: "Launch post", exact: true })).toHaveCount(0);
    // Saved on the account
    await expect.poll(async () => (await (await admin.api.get("/api/account")).json()).data.preferences.hiddenProjects).toEqual([marketingId]);
    // Picking the project explicitly still shows it
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table&projectId=${marketingId}`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Launch post", exact: true })).toBeVisible();

    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    await page.getByRole("button", { name: "Show Marketing in My Tasks" }).click();
    await expect(page.getByRole("button", { name: "Launch post", exact: true })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});
