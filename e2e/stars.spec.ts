import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, type TestUser } from "./helpers";

// Personal stars on tasks and routines, and the Starred page across workspaces
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
const starred = async (user: TestUser, includeDone = false) =>
    json(await user.api.get(`/api/stars?includeDone=${includeDone}`)) as Promise<{
        tasks: { id: string; workspaceName: string }[];
        routines: { id: string; workspaceName: string }[];
    }>;

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

test("the list covers every workspace; done tasks only on request; deleted tasks drop out", async () => {
    expect((await owner.api.post("/api/stars", { data: { taskId: otherTaskId } })).status()).toBe(200);
    expect((await owner.api.post("/api/stars", { data: { taskId: doneTaskId } })).status()).toBe(200);

    const list = await starred(owner);
    expect(list.tasks.map((task) => [task.id, task.workspaceName]).sort()).toEqual([
        [otherTaskId, "Beta stars"],
        [taskId, "Alpha stars"],
    ].sort());
    expect(list.routines).toMatchObject([{ id: routineId, workspaceName: "Alpha stars" }]);
    expect((await starred(owner, true)).tasks.map((task) => task.id)).toContain(doneTaskId);

    expect((await owner.api.delete(`/api/tasks/${doneTaskId}`)).status()).toBe(200);
    expect((await starred(owner, true)).tasks.map((task) => task.id)).not.toContain(doneTaskId);
});

test("leaving a workspace clears its stars", async () => {
    expect((await viewer.api.post("/api/members/leave-workspace", { data: { workspaceId: first.$id } })).status()).toBe(200);
    expect((await starred(viewer)).tasks).toEqual([]);

    // Coming back starts with no stars
    const full = await json(await owner.api.get(`/api/workspaces/${first.$id}`)) as { viewerInviteCode: string };
    expect((await viewer.api.post(`/api/workspaces/${first.$id}/join`, { data: { code: full.viewerInviteCode } })).status()).toBe(200);
    expect((await ids(viewer, first.$id)).taskIds).toEqual([]);
});

const open = async (page: Page, url: string) => page.goto(url, { timeout: 90_000 });

test("star from the table and kanban; the Starred page groups by workspace", async ({ page, baseURL }) => {
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

    await open(page, `/workspaces/${first.$id}/starred`);
    // One section per workspace, each headed by the workspace name
    const sections = page.locator("section").filter({ has: page.getByRole("heading", { level: 2 }) });
    await expect(sections.nth(0).getByRole("heading")).toHaveText("Alpha stars");
    await expect(sections.nth(1).getByRole("heading")).toHaveText("Beta stars");
    await expect(sections.nth(0).getByTestId("starred-routine")).toContainText("Morning sync");

    // This workspace's task opens in the side panel; another workspace's opens its full page
    await sections.nth(0).getByText("Starred alpha task").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await sections.nth(1).getByText("Starred beta task").click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${second.$id}/tasks/${otherTaskId}$`));

    // Unstarring removes it from the page
    await open(page, `/workspaces/${first.$id}/starred`);
    await page.getByRole("button", { name: "Unstar Starred beta task" }).click();
    await expect(page.getByText("Starred beta task")).toHaveCount(0);
});

test("the empty state", async ({ page, baseURL }) => {
    await signInBrowser(page, viewer, baseURL!);
    await open(page, `/workspaces/${first.$id}/starred`);
    await expect(page.getByText("Star tasks and routines to keep them here")).toBeVisible();
});
