import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// The saved My Tasks filter (several people, several statuses, Starred, Overdue, with live counts),
// Home following it, and Routines keeping their own
test.describe.configure({ mode: "serial" });

let me: TestUser, teammate: TestUser;
let workspaceId: string, projectId: string;
let myId: string, mateId: string, placeholderId: string;
let page: Page;
let errors: string[];

type Doc = { $id: string; name: string };
const json = async (res: { json: () => Promise<unknown> }) => (await res.json() as { data: never }).data;
const names = async (query: string) =>
    ((await json(await me.api.get(`/api/tasks?workspaceId=${workspaceId}&${query}`))) as { documents: Doc[] }).documents
        // Leave out the routine's own tasks (the Routines test needs one routine)
        .map((t) => t.name).filter((name) => name !== "Weekly sync").sort();

test.beforeAll(async ({ baseURL, browser }) => {
    me = await registerUser(baseURL!, "Fern Filter");
    teammate = await registerUser(baseURL!, "Theo Mate");
    const workspace = await createWorkspace(me.api, "Filters");
    workspaceId = workspace.$id;
    projectId = (await createProject(me.api, workspaceId, "Website")).$id;
    expect((await teammate.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    expect((await me.api.post("/api/members/placeholders", { data: { workspaceId, name: "Pat Placeholder" } })).status()).toBe(200);
    const people = await getMembers(me.api, workspaceId) as { $id: string; name: string }[];
    myId = people.find((p) => p.name === "Fern Filter")!.$id;
    mateId = people.find((p) => p.name === "Theo Mate")!.$id;
    placeholderId = people.find((p) => p.name === "Pat Placeholder")!.$id;

    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    for (const [name, assigneeIds, status, dueDate] of [
        ["Mine todo", [myId], "TODO", tomorrow],
        ["Mine late", [myId], "IN_PROGRESS", yesterday],
        ["Shared review", [myId, mateId], "IN_REVIEW", tomorrow],
        ["Theirs todo", [mateId], "TODO", tomorrow],
        ["Placeholder done", [placeholderId], "DONE", yesterday],
    ] as const) {
        expect((await createTask(me.api, { workspaceId, projectId, name, assigneeIds: [...assigneeIds], status, dueDate })).status()).toBe(200);
    }
    const routine = await me.api.post("/api/routines", { data: { workspaceId, name: "Weekly sync", assigneeIds: [myId], weekdays: [1] } });
    expect(routine.status(), await routine.text()).toBe(200);
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    errors = watchConsole(page);
    await signInBrowser(page, me, baseURL!);
});

test.afterAll(async () => {
    await page.close();
});

test("the list takes several people and statuses, and Overdue", async () => {
    expect(await names("assignees=me")).toEqual(["Mine late", "Mine todo", "Shared review"]);
    expect(await names(`assignees=${mateId},${placeholderId}`)).toEqual(["Placeholder done", "Shared review", "Theirs todo"]);
    expect(await names("statuses=TODO,DONE")).toEqual(["Mine todo", "Placeholder done", "Theirs todo"]);
    expect(await names("assignees=me&statuses=TODO,IN_REVIEW")).toEqual(["Mine todo", "Shared review"]);
    // Done tasks are never overdue
    expect(await names("overdue=true")).toEqual(["Mine late"]);
});

test("the chips' counts leave out their own row", async () => {
    const facets = await json(await me.api.get(`/api/tasks/facets?workspaceId=${workspaceId}&projectId=${projectId}&assignees=me&statuses=TODO`)) as {
        everyone: number; people: Record<string, number>; allStatuses: number; statuses: Record<string, number>; overdue: number;
    };
    // People counted with the status choice (To Do): everyone's To Do tasks
    expect(facets.everyone).toBe(2);
    expect(facets.people[myId]).toBe(1);
    expect(facets.people[mateId]).toBe(1);
    // Statuses counted with the people choice (me): my tasks by status
    expect(facets.allStatuses).toBe(3);
    expect(facets.statuses).toMatchObject({ TODO: 1, IN_PROGRESS: 1, IN_REVIEW: 1 });
    expect(facets.overdue).toBe(0);
});

test("My Tasks: pick several chips; the choice is saved and shown again", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    const filters = page.getByTestId("task-filters");
    const rows = page.locator("tbody tr");
    await expect(rows.filter({ hasText: "Theirs todo" })).toHaveCount(1);
    await expect(filters.getByRole("button", { name: /^Everyone/ })).toHaveAttribute("aria-pressed", "true");

    await filters.getByRole("button", { name: /^Me\b/ }).click();
    await expect(rows.filter({ hasText: "Theirs todo" })).toHaveCount(0);
    await filters.getByRole("button", { name: /^Todo/ }).click();
    await filters.getByRole("button", { name: /^In Review/ }).click();
    await expect(rows.filter({ hasText: "Mine late" })).toHaveCount(0);
    await expect(rows.filter({ hasText: "Mine todo" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Shared review" })).toHaveCount(1);

    await expect.poll(async () => (await json(await me.api.get("/api/account")) as { preferences: { taskFilters: Record<string, unknown> } })
        .preferences.taskFilters[workspaceId]).toMatchObject({ people: ["me"], statuses: ["TODO", "IN_REVIEW"] });
    await page.reload();
    await expect(page.getByTestId("task-filters").getByRole("button", { name: /^Todo/ })).toHaveAttribute("aria-pressed", "true");
    await expect(rows.filter({ hasText: "Shared review" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Theirs todo" })).toHaveCount(0);
});

test("search: shortcuts and plain words narrow further", async () => {
    await page.getByLabel("Search tasks").fill("status:review");
    await expect(page.locator("tbody tr").filter({ hasText: "Mine todo" })).toHaveCount(0);
    await expect(page.locator("tbody tr").filter({ hasText: "Shared review" })).toHaveCount(1);
    // Plain words: a teammate's first name and a status, read back under the box
    await page.getByLabel("Search tasks").fill("theo in review");
    await expect(page.getByTestId("search-understood")).toContainText("Theo Mate · In Review");
    await expect(page.locator("tbody tr").filter({ hasText: "Shared review" })).toHaveCount(1);
    await expect(page.locator("tbody tr").filter({ hasText: "Mine todo" })).toHaveCount(0);
    // Enter locks what it understood into the chips and keeps only the other words
    await page.getByLabel("Search tasks").press("Enter");
    const filters = page.getByTestId("task-filters");
    await expect(filters.getByRole("button", { name: /^Theo Mate/ })).toHaveAttribute("aria-pressed", "true");
    await expect(filters.getByRole("button", { name: /^In Review/ })).toHaveAttribute("aria-pressed", "true");
    await expect(filters.getByRole("button", { name: /^Todo/ })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByLabel("Search tasks")).toHaveValue("");
    await expect(page.locator("tbody tr").filter({ hasText: "Shared review" })).toHaveCount(1);
    // Back to Me + To Do + In Review for the tests below
    await filters.getByRole("button", { name: /^Theo Mate/ }).click();
    await filters.getByRole("button", { name: /^Me\b/ }).click();
    await filters.getByRole("button", { name: /^Todo/ }).click();
    // Quotes search names only: "review" matches the name, not the status
    await page.getByLabel("Search tasks").fill('"review"');
    await expect(page.getByTestId("search-understood")).toContainText('name has "review"');
    await expect(page.locator("tbody tr").filter({ hasText: "Shared review" })).toHaveCount(1);
    await page.getByLabel("Search tasks").fill("");
    await expect(page.locator("tbody tr").filter({ hasText: "Mine todo" })).toHaveCount(1);
});

test("Home follows My Tasks; My work stays mine", async () => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    const note = page.getByTestId("home-following");
    await expect(note).toContainText("Me · Todo + In Review");

    // Following someone else: My work still lists only my own tasks
    await me.api.patch("/api/account/preferences", { data: { taskFilters: { [workspaceId]: { people: [mateId], statuses: [], starred: false, overdue: false } } } });
    await page.reload();
    await expect(note).toContainText("Theo Mate · All");
    const myWork = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "My work" }) }).last();
    await expect(myWork.getByText("Theirs todo")).toHaveCount(0);
});

test("Routines keep their own filter; Reset clears My Tasks", async () => {
    await page.goto(`/workspaces/${workspaceId}/routines`, { timeout: 90_000 });
    const routineFilters = page.getByTestId("routine-filters");
    await expect(routineFilters.getByRole("button", { name: /^Everyone/ })).toHaveAttribute("aria-pressed", "true");
    await routineFilters.getByRole("button", { name: /^Paused/ }).click();
    await expect.poll(async () => (await json(await me.api.get("/api/account")) as { preferences: { routineFilters: Record<string, { tags: string[] }>; taskFilters: Record<string, { people: string[] }> } })
        .preferences).toMatchObject({ routineFilters: { [workspaceId]: { tags: ["paused"] } }, taskFilters: { [workspaceId]: { people: [mateId] } } });

    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    await page.getByTestId("task-filters").getByRole("button", { name: "Reset" }).click();
    await expect(page.locator("tbody tr").filter({ hasText: "Theirs todo" })).toHaveCount(1);
    await expect(page.locator("tbody tr").filter({ hasText: "Placeholder done" })).toHaveCount(1);
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    await expect(page.getByTestId("home-following")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
});
