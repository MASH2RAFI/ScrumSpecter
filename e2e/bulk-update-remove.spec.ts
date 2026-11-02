import { expect, test, type APIRequestContext } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Bulk input: update and remove commands, routine descriptions, and the routine view toggles in
// the check results
test.describe.configure({ mode: "serial" });

// uiAdmin drives the browser tests: bulk applies are limited to 10 an hour per account
let admin: TestUser, member: TestUser, uiAdmin: TestUser;
let workspace: { $id: string; inviteCode: string };
let projectId: string;
const ids: Record<string, string> = {};

const json = async (res: Awaited<ReturnType<APIRequestContext["get"]>>) => {
    const body = await res.json() as { data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    return body.data;
};
const run = async (user: TestUser, script: string, apply = true) => {
    const res = await user.api.post(`/api/workspaces/${workspace.$id}/bulk`, { data: { script, apply } });
    expect(res.status(), await res.text()).toBe(200);
    return json(res);
};
const tasksNamed = async (name: string) =>
    ((await json(await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&search=${encodeURIComponent(name)}`))).documents as
        { $id: string; name: string; status: string; storyPoints: number; assigneeIds: string[]; description: string | null; routineId: string | null }[])
        .filter((task) => task.name === name);
const routines = async () =>
    (await json(await admin.api.get(`/api/routines?workspaceId=${workspace.$id}`))).documents as
        { $id: string; name: string; description: string | null; showInKanban: boolean; showInTable: boolean; showInCalendar: boolean }[];

test.beforeAll(async ({ baseURL }) => {
    [admin, member, uiAdmin] = await Promise.all(["Uma Updater", "Max Member", "Ivy Interface"].map((name) => registerUser(baseURL!, name)));
    workspace = await createWorkspace(admin.api, "Bulk update WS");
    projectId = (await createProject(admin.api, workspace.$id, "Core", 14)).$id;
    await createProject(admin.api, workspace.$id, "Extra", 14);
    for (const user of [member, uiAdmin]) {
        expect((await user.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    }
    for (const row of await getMembers(admin.api, workspace.$id)) ids[row.name] = row.$id;
    expect((await admin.api.patch(`/api/members/${ids[uiAdmin.name]}`, { data: { role: "ADMIN" } })).status()).toBe(200);
});

test("routine add takes a description, and its tasks get it", async () => {
    const body = await run(admin, `routine add "Standup" project:"Core" days:daily description:"Yesterday, today, blockers"`);
    expect(body.applied, JSON.stringify(body)).toBe(true);
    const standup = (await routines()).find((routine) => routine.name === "Standup")!;
    expect(standup.description).toBe("Yesterday, today, blockers");
    const generated = (await tasksNamed("Standup")).filter((task) => task.routineId === standup.$id);
    expect(generated.length).toBeGreaterThan(0);
    expect(generated.every((task) => task.description === "Yesterday, today, blockers")).toBe(true);
});

test("task update: status, points, assignees and a new name", async () => {
    expect((await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: ids[admin.name], name: "Draft spec" })).status()).toBe(200);
    const body = await run(admin, `task update "draft spec" status:in_progress points:8 assignee:"${member.name}, me" name:"Final spec"`);
    expect(body.applied, JSON.stringify(body)).toBe(true);
    expect(body.counts).toEqual({ taskUpdate: 1 });
    expect(await tasksNamed("Draft spec")).toHaveLength(0);
    const [task] = await tasksNamed("Final spec");
    expect(task).toMatchObject({ status: "IN_PROGRESS", storyPoints: 8 });
    expect(task.assigneeIds.sort()).toEqual([ids[admin.name], ids[member.name]].sort());
});

test("an ambiguous name fails; project: or id: resolves it", async () => {
    const extraId = (await json(await admin.api.get(`/api/projects?workspaceId=${workspace.$id}`))).documents
        .find((project: { name: string }) => project.name === "Extra").$id;
    for (const id of [projectId, extraId]) {
        expect((await createTask(admin.api, { workspaceId: workspace.$id, projectId: id, assigneeId: ids[admin.name], name: "Twin" })).status()).toBe(200);
    }
    const ambiguous = await run(admin, `task update "Twin" status:done`);
    expect(ambiguous.applied).toBe(false);
    expect(ambiguous.results[0].error).toBe(`2 tasks are called "Twin"; add project: or use id:`);

    expect((await run(admin, `task update "Twin" project:"Extra" points:2`)).applied).toBe(true);
    const twins = await tasksNamed("Twin");
    const core = twins.find((task) => task.storyPoints !== 2)!;
    expect((await run(admin, `task update id:${core.$id} status:done`)).applied).toBe(true);
    expect((await tasksNamed("Twin")).find((task) => task.$id === core.$id)!.status).toBe("DONE");
});

test("assignees can't update or remove", async () => {
    const body = await run(member, `task update "Final spec" status:done\ntask remove "Final spec"`);
    expect(body.applied).toBe(false);
    expect(body.results[0].error).toMatch(/^Only admins and supervisors can update tasks/);
    expect(body.results[1].error).toMatch(/^Only admins and supervisors can remove tasks/);
});

test("remove a task, a routine and a day off; the check lists what goes, and Undo brings tasks back", async () => {
    expect((await run(admin, `holiday add 2026-12-31 "Year-end"`)).applied).toBe(true);
    const script = `task remove "Final spec"\nroutine remove "Standup"\nholiday remove 2026-12-31`;
    const checked = await run(admin, script, false);
    expect(checked.results.map((r: { removes: boolean; summary: string }) => [r.removes, r.summary])).toEqual([
        [true, expect.stringMatching(/^Delete task "Final spec"( \(due \d{4}-\d{2}-\d{2}\))?$/)],
        [true, `Delete routine "Standup" (tasks it already made stay)`],
        [true, "Remove day off 2026-12-31: Year-end"],
    ]);

    const body = await run(admin, script);
    expect(body.applied, JSON.stringify(body)).toBe(true);
    expect(body.removed).toHaveLength(1);
    expect(await tasksNamed("Final spec")).toHaveLength(0);
    expect((await routines()).map((routine) => routine.name)).not.toContain("Standup");
    const holidays = await json(await admin.api.get(`/api/workspaces/${workspace.$id}/holidays?from=2026-12-01&to=2027-01-31`));
    expect(JSON.stringify(holidays)).not.toContain("Year-end");

    // Undo: the snapshots go back through /api/tasks/restore
    const restore = await admin.api.post("/api/tasks/restore", { data: { tasks: body.removed } });
    expect(restore.status(), await restore.text()).toBe(200);
    expect((await tasksNamed("Final spec"))[0]).toMatchObject({ status: "IN_PROGRESS", storyPoints: 8 });
});

test("a script mixing add, update and remove applies fully or not at all", async () => {
    const broken = await run(admin, [
        `task add "Mixed new" project:"Core"`,
        `task update "Final spec" status:in_review`,
        `task remove "No such task"`,
    ].join("\n"));
    expect(broken.applied).toBe(false);
    expect(broken.results[2].error).toBe(`No task called "No such task"`);
    expect(await tasksNamed("Mixed new")).toHaveLength(0);
    expect((await tasksNamed("Final spec"))[0].status).toBe("IN_PROGRESS");

    // A line may refer to something added earlier in the same script
    const body = await run(admin, [
        `task add "Mixed new" project:"Core"`,
        `task update "Mixed new" name:"Mixed renamed"`,
        `task update "Final spec" status:in_review`,
        `task remove "Final spec"`,
    ].join("\n"));
    expect(body.applied, JSON.stringify(body)).toBe(true);
    expect(await tasksNamed("Mixed renamed")).toHaveLength(1);
    expect(await tasksNamed("Final spec")).toHaveLength(0);
});

test("at most 50 removals per script", async () => {
    const lines = Array.from({ length: 51 }, (_, i) => `task add "Bulk ${i}" project:"Core"`);
    expect((await run(admin, lines.join("\n"))).applied).toBe(true);
    const removes = Array.from({ length: 51 }, (_, i) => `task remove "Bulk ${i}"`);
    const body = await run(admin, removes.join("\n"), false);
    expect(body.results.slice(0, 50).every((r: { ok: boolean }) => r.ok)).toBe(true);
    expect(body.results[50].error).toBe("At most 50 removals per script");
});

test("routine view toggles in the check results rewrite show: and apply", async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, uiAdmin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Bulk input" }).click();

    await settings.getByLabel("Commands").fill(`routine add "Retro" project:"Core" days:mon`);
    await settings.getByRole("button", { name: "Check" }).click();
    const views = settings.getByRole("group", { name: "Views for line 1" });
    await expect(views.getByRole("button", { name: "kanban" })).toHaveAttribute("aria-pressed", "true");
    await views.getByRole("button", { name: "kanban" }).click();
    await expect(views.getByRole("button", { name: "kanban" })).toHaveAttribute("aria-pressed", "false");
    await expect(settings.getByLabel("Commands")).toHaveValue(`routine add "Retro" project:"Core" days:mon show:table,calendar`);
    await settings.getByRole("button", { name: "Apply 1 change" }).click();
    await expect(page.getByText("Added 1 routine")).toBeVisible();

    const retro = (await routines()).find((routine) => routine.name === "Retro")!;
    expect(retro).toMatchObject({ showInTable: true, showInKanban: false, showInCalendar: true });
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

test("removals ask first in the UI", async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await signInBrowser(page, uiAdmin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Bulk input" }).click();

    await settings.getByLabel("Commands").fill(`task remove "Mixed renamed"`);
    await settings.getByRole("button", { name: "Check" }).click();
    await settings.getByRole("button", { name: "Delete 1 item…" }).click();
    await page.getByRole("dialog", { name: "Delete 1 item?" }).getByRole("button", { name: "Cancel" }).click();
    expect(await tasksNamed("Mixed renamed")).toHaveLength(1);

    await settings.getByRole("button", { name: "Delete 1 item…" }).click();
    await page.getByRole("dialog", { name: "Delete 1 item?" }).getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("1 task deleted")).toBeVisible();
    await expect.poll(async () => (await tasksNamed("Mixed renamed")).length).toBe(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await tasksNamed("Mixed renamed")).length).toBe(1);
    await page.close();
});
