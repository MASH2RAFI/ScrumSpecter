import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, type TestUser } from "./helpers";

// Personal routines and tasks: no project; a personal routine keeps the next 14 days filled
test.describe.configure({ mode: "serial" });

let admin: TestUser;
let workspaceId: string;
let projectId: string;
let memberId: string;

const DAY = 86_400_000;
const dayOffset = (iso: string) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(new Date().toISOString().slice(0, 10))) / DAY);
const list = async (query = "") =>
    (await (await admin.api.get(`/api/tasks?workspaceId=${workspaceId}${query}`)).json()).data.documents as
        { $id: string; name: string; projectId: string | null; dueDate: string | null; routineId: string | null }[];

test.beforeAll(async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Pia Personal");
    workspaceId = (await createWorkspace(admin.api, "Personal WS")).$id;
    projectId = (await createProject(admin.api, workspaceId, "Team work", 30)).$id;
    memberId = (await getMembers(admin.api, workspaceId))[0].$id;
});

test("a routine with no project fills the next 14 days", async () => {
    const res = await admin.api.post("/api/routines", {
        data: { workspaceId, name: "Journal", assigneeIds: [memberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).data.projectId).toBeNull();

    const journal = (await list("&search=Journal")).filter((task) => task.name === "Journal");
    // Public holidays are skipped, so not always exactly 14
    expect(journal.length).toBeGreaterThanOrEqual(10);
    expect(journal.every((task) => task.projectId === null)).toBe(true);
    const offsets = journal.map((task) => dayOffset(task.dueDate!));
    expect(Math.max(...offsets)).toBeLessThanOrEqual(13);
    expect(Math.max(...offsets)).toBeGreaterThanOrEqual(8);
});

test("personal tasks: create, filter, hidden projects, move in and out of a project", async () => {
    // No projectId at all: a personal task
    const created = await admin.api.post("/api/tasks", { data: { workspaceId, name: "Dentist", status: "TODO", assigneeIds: [memberId], storyPoints: 1 } });
    expect(created.status(), await created.text()).toBe(200);
    const dentist = (await created.json()).data as { $id: string; projectId: string | null };
    expect(dentist.projectId).toBeNull();
    expect((await createTask(admin.api, { workspaceId, projectId, assigneeId: memberId, name: "Team task" })).status()).toBe(200);

    // projectId=none: only personal ones
    const personal = await list("&projectId=none");
    expect(personal.map((task) => task.name)).toContain("Dentist");
    expect(personal.every((task) => task.projectId === null)).toBe(true);

    // Hiding a project in My Tasks must not hide personal tasks (NOT IN is never true for NULL)
    const visible = (await list(`&excludeProjects=${projectId}`)).map((task) => task.name);
    expect(visible).toContain("Dentist");
    expect(visible).not.toContain("Team task");

    // Into a project and back out
    expect((await admin.api.patch(`/api/tasks/${dentist.$id}`, { data: { projectId } })).status()).toBe(200);
    expect((await list("&projectId=none")).map((task) => task.name)).not.toContain("Dentist");
    expect((await admin.api.patch(`/api/tasks/${dentist.$id}`, { data: { projectId: null } })).status()).toBe(200);
    expect((await list("&projectId=none")).map((task) => task.name)).toContain("Dentist");
});

test("bulk input: no project: means personal", async () => {
    const res = await admin.api.post(`/api/workspaces/${workspaceId}/bulk`, {
        data: { script: `task add "Gym" due:tomorrow\nroutine add "Read" days:mon,thu`, apply: true },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).data.applied).toBe(true);
    expect((await list("&projectId=none&search=Gym"))).toHaveLength(1);
    const routines = (await (await admin.api.get(`/api/routines?workspaceId=${workspaceId}`)).json()).data.documents as { name: string; projectId: string | null }[];
    expect(routines.find((routine) => routine.name === "Read")?.projectId).toBeNull();
});

test("per-project numbers leave personal tasks out; the totals keep them", async () => {
    const weekFrom = new Date(Date.now() - 7 * DAY).toISOString();
    const weekTo = new Date(Date.now() + 7 * DAY).toISOString();
    const summary = (await (await admin.api.get(`/api/tasks/summary?workspaceId=${workspaceId}&weekFrom=${weekFrom}&weekTo=${weekTo}`)).json()).data as
        { total: number; projects: { projectId: string }[] };
    expect(summary.projects.every((row) => row.projectId)).toBe(true);
    expect(summary.projects.map((row) => row.projectId)).toEqual([projectId]);
    expect(summary.total).toBeGreaterThan(1);
});

test("the routine form offers No project; the routine shows as Personal", async ({ page, baseURL }) => {
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/routines`, { timeout: 90_000 });
    await expect(page.getByText("Journal").first()).toBeVisible();
    await expect(page.getByText(/Personal/).first()).toBeVisible();

    await page.getByRole("button", { name: /New routine/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("e.g. Weekly team sync").fill("Stretch");
    await dialog.getByRole("combobox").filter({ hasText: "Select project" }).click();
    await page.getByRole("option", { name: "No project (personal)" }).click();
    await expect(dialog.getByRole("combobox").filter({ hasText: "No project (personal)" })).toBeVisible();
});
