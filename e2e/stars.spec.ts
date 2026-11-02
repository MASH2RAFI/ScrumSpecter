import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, type TestUser } from "./helpers";

// Personal stars on tasks and routines, and the Starred filter on My Tasks and Routines
test.describe.configure({ mode: "serial" });

let owner: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let first: { $id: string; name: string };
let second: { $id: string; name: string };
let taskId: string;
let doneTaskId: string;
let otherTaskId: string;
let routineId: string;

const json = async (res: { json: () => Promise<unknown> }) => (await res.json() as { data: never }).data;
const ids = async (user: TestUser, workspaceId: string) =>
    json(await user.api.get(`/api/stars/ids?workspaceId=${workspaceId}`)) as Promise<{ taskIds: string[]; routineIds: string[] }>;
// My Tasks with the Starred filter on (routine tasks included: no week scope)
const starred = async (user: TestUser, workspaceId: string) =>
    (await json(await user.api.get(`/api/tasks?workspaceId=${workspaceId}&starred=true`)) as { documents: { $id: string; name: string; routineId: string | null }[] }).documents;

test.beforeAll(async ({ baseURL }) => {
    owner = await registerUser(baseURL!, "Stella Stars");
    viewer = await registerUser(baseURL!, "Vic Viewer");
    stranger = await registerUser(baseURL!, "Sam Stranger");
    first = await createWorkspace(owner.api, "Alpha stars");
    second = await createWorkspace(owner.api, "Beta stars");
    const project = await createProject(owner.api, first.$id, "Apollo");
    const otherProject = await createProject(owner.api, second.$id, "Borealis");

    // Tasks and routines need at least one assignee: the owner
    const ownerIn = async (workspaceId: string) => (await getMembers(owner.api, workspaceId))[0].$id;
    const firstOwner = await ownerIn(first.$id);
    const secondOwner = await ownerIn(second.$id);
    const make = async (workspaceId: string, projectId: string, name: string, status = "TODO") =>
        (await json(await createTask(owner.api, { workspaceId, projectId, name, status, assigneeId: workspaceId === first.$id ? firstOwner : secondOwner })) as { $id: string }).$id;
    taskId = await make(first.$id, project.$id, "Starred alpha task");
    doneTaskId = await make(first.$id, project.$id, "Finished alpha task", "DONE");
    otherTaskId = await make(second.$id, otherProject.$id, "Starred beta task");

    const routine = await owner.api.post("/api/routines", {
        data: { workspaceId: first.$id, name: "Morning sync", projectId: project.$id, assigneeIds: [firstOwner], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect(routine.status(), await routine.text()).toBe(200);
    routineId = (await json(routine) as { $id: string }).$id;

    const full = await json(await owner.api.get(`/api/workspaces/${first.$id}`)) as { viewerInviteCode: string };
    expect((await viewer.api.post(`/api/workspaces/${first.$id}/join`, { data: { code: full.viewerInviteCode } })).status()).toBe(200);
});

test("star and unstar a task and a routine; starring twice is harmless", async () => {
    for (let i = 0; i < 2; i++) {
        expect((await owner.api.post("/api/stars", { data: { taskId } })).status()).toBe(200);
        expect((await owner.api.post("/api/stars", { data: { routineId } })).status()).toBe(200);
    }
    expect(await ids(owner, first.$id)).toEqual({ taskIds: [taskId], routineIds: [routineId] });

    expect((await owner.api.delete("/api/stars", { data: { routineId } })).status()).toBe(200);
    expect((await owner.api.delete("/api/stars", { data: { routineId } })).status()).toBe(200);
    expect(await ids(owner, first.$id)).toEqual({ taskIds: [taskId], routineIds: [] });
    expect((await owner.api.post("/api/stars", { data: { routineId } })).status()).toBe(200);

    // Exactly one item
    expect((await owner.api.post("/api/stars", { data: { taskId, routineId } })).status()).toBe(400);
    expect((await owner.api.post("/api/stars", { data: {} })).status()).toBe(400);
});

test("a viewer can star; someone outside the workspace can't", async () => {
    expect((await viewer.api.post("/api/stars", { data: { taskId } })).status()).toBe(200);
    expect((await ids(viewer, first.$id)).taskIds).toEqual([taskId]);

    expect((await stranger.api.post("/api/stars", { data: { taskId } })).status()).toBe(401);
    expect((await stranger.api.post("/api/stars", { data: { routineId } })).status()).toBe(401);
    expect((await stranger.api.post("/api/stars", { data: { taskId: "no-such-task" } })).status()).toBe(401);
    expect((await stranger.api.get(`/api/stars/ids?workspaceId=${first.$id}`)).status()).toBe(401);
});

test("the Starred filter: starred tasks and the tasks of starred routines, in this workspace only", async () => {
    expect((await owner.api.post("/api/stars", { data: { taskId: otherTaskId } })).status()).toBe(200);
    const list = await starred(owner, first.$id);
    const names = new Set(list.map((task) => task.name));
    // The starred task, the routine's tasks; not the unstarred done task, nor the other workspace's star
    expect(list.some((task) => task.$id === taskId)).toBe(true);
    expect(list.some((task) => task.routineId === routineId)).toBe(true);
    expect(names.has("Finished alpha task")).toBe(false);
    expect(list.some((task) => task.$id === otherTaskId)).toBe(false);
    expect((await starred(owner, second.$id)).map((task) => task.$id)).toEqual([otherTaskId]);

    // Someone else's stars don't count; outsiders get nothing
    expect((await stranger.api.get(`/api/tasks?workspaceId=${first.$id}&starred=true`)).status()).toBe(401);
    expect((await starred(viewer, first.$id)).map((task) => task.$id)).toEqual([taskId]);
});

test("leaving a workspace clears its stars", async () => {
    expect((await viewer.api.post("/api/members/leave-workspace", { data: { workspaceId: first.$id } })).status()).toBe(200);

    // Coming back starts with no stars
    const full = await json(await owner.api.get(`/api/workspaces/${first.$id}`)) as { viewerInviteCode: string };
    expect((await viewer.api.post(`/api/workspaces/${first.$id}/join`, { data: { code: full.viewerInviteCode } })).status()).toBe(200);
    expect((await ids(viewer, first.$id)).taskIds).toEqual([]);
});

const open = async (page: Page, url: string) => page.goto(url, { timeout: 90_000 });

test("star from the table and kanban; the Starred filter on My Tasks (calendar too) and Routines", async ({ page, baseURL }) => {
    await owner.api.delete("/api/stars", { data: { taskId } });
    await signInBrowser(page, owner, baseURL!);

    await open(page, `/workspaces/${first.$id}/tasks?task-view=table`);
    const star = page.getByRole("button", { name: "Star Starred alpha task", exact: true });
    await star.click();
    await expect(page.getByRole("button", { name: "Unstar Starred alpha task", exact: true })).toHaveAttribute("aria-pressed", "true");
    // Starring doesn't open the task
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await open(page, `/workspaces/${first.$id}/tasks?task-view=kanban`);
    await page.getByRole("button", { name: "Unstar Starred alpha task", exact: true }).click();
    await expect(page.getByRole("button", { name: "Star Starred alpha task", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Star Starred alpha task", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unstar Starred alpha task", exact: true })).toBeVisible();

    // The filter: a saved chip (still on after a reload), and the same list in the calendar
    await open(page, `/workspaces/${first.$id}/tasks?task-view=table`);
    const taskStarred = page.getByTestId("task-filters").getByRole("button", { name: /^Starred/ });
    await taskStarred.click();
    await expect(taskStarred).toHaveAttribute("aria-pressed", "true");
    const rows = page.locator("tbody tr");
    await expect(rows.filter({ hasText: "Starred alpha task" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Finished alpha task" })).toHaveCount(0);
    await expect.poll(async () => (await (await owner.api.get("/api/account")).json()).data.preferences.taskFilters[first.$id]?.starred).toBe(true);
    await page.reload();
    await expect(page.getByTestId("task-filters").getByRole("button", { name: /^Starred/ })).toHaveAttribute("aria-pressed", "true");
    // Unstarring takes it off the filtered list straight away
    await page.getByRole("button", { name: "Unstar Starred alpha task", exact: true }).click();
    await expect(rows.filter({ hasText: "Starred alpha task" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Calendar" }).click();
    await expect(page.locator(".rbc-month-view")).toBeVisible();

    // Routines have their own filter: My Tasks' Starred doesn't carry over
    await open(page, `/workspaces/${first.$id}/routines`);
    const routineStarred = page.getByTestId("routine-filters").getByRole("button", { name: /^Starred/ });
    await expect(routineStarred).toHaveAttribute("aria-pressed", "false");
    await routineStarred.click();
    await expect(page.getByRole("button", { name: /Unstar Morning sync/ }).first()).toBeVisible();
    // Unstarring it with the filter on leaves nothing to show
    await page.getByRole("button", { name: /Unstar Morning sync/ }).first().click();
    await expect(page.getByText("No routines match this filter")).toBeVisible();
    await expect.poll(async () => (await ids(owner, first.$id)).routineIds).toEqual([]);
});
