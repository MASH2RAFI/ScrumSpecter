import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Large workspaces: views load only what they show (table pages, kanban's latest Done, the
// calendar's dates, Home's counts from the server)
test.describe.configure({ mode: "serial" });

let user: TestUser;
let workspaceId: string;

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
// The whole of this week and beyond, whatever the week start
const week = { weekFrom: new Date(Date.now() - 8 * 86_400_000).toISOString(), weekTo: new Date(Date.now() + 8 * 86_400_000).toISOString() };

const list = async (params: Record<string, string | number | boolean>) => {
    const query = new URLSearchParams(Object.fromEntries(Object.entries({ workspaceId, ...params }).map(([k, v]) => [k, String(v)])));
    const res = await user.api.get(`/api/tasks?${query}`);
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data as { documents: { $id: string; name: string; status: string; dueDate: string | null }[]; total: number; doneTotal: number | null; hiddenRoutineTasks: number };
};

test.beforeAll(async ({ baseURL }) => {
    user = await registerUser(baseURL!, "Paging Pat");
    workspaceId = (await createWorkspace(user.api, "Big workspace")).$id;
    await createProject(user.api, workspaceId, "Ops", 14);
    // 60 open tasks spread over the next weeks, 105 done ones, 5 with no date
    const lines = [
        ...Array.from({ length: 60 }, (_, i) => `task add "Open ${String(i).padStart(2, "0")}" project:"Ops" due:${iso(i % 30)}`),
        ...Array.from({ length: 105 }, (_, i) => `task add "Done ${String(i).padStart(3, "0")}" project:"Ops" status:done due:${iso(-(i % 20))}`),
        ...Array.from({ length: 5 }, (_, i) => `task add "Someday ${i}" project:"Ops"`),
    ];
    const res = await user.api.post(`/api/workspaces/${workspaceId}/bulk`, { data: { script: lines.join("\n"), apply: true } });
    expect((await res.json()).data.applied).toBe(true);
});

test("the table loads 25 at a time, sorted on the server, without repeats", async () => {
    const seen = new Set<string>();
    let total = 0;
    for (let page = 0; page < 7; page++) {
        const data = await list({ scope: "table", ...week, limit: 25, offset: page * 25, sortBy: "name", sortDir: "asc" });
        total = data.total;
        expect(data.documents.length).toBeLessThanOrEqual(25);
        for (const task of data.documents) {
            expect(seen.has(task.$id), "a task appeared on two pages").toBe(false);
            seen.add(task.$id);
        }
        const names = data.documents.map((t) => t.name);
        expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    }
    expect(total).toBe(170);
    expect(seen.size).toBe(170);
});

test("kanban: every open task, and only the latest 100 Done", async () => {
    const data = await list({ scope: "kanban", ...week, doneLimit: 100 });
    expect(data.documents.filter((t) => t.status === "DONE")).toHaveLength(100);
    expect(data.documents.filter((t) => t.status !== "DONE")).toHaveLength(65);
    expect(data.doneTotal).toBe(105);
});

test("the calendar asks for its dates; undated tasks come separately", async () => {
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 6 * 86_400_000).toISOString();
    const dated = await list({ scope: "calendar", from, to });
    expect(dated.documents.length).toBeGreaterThan(0);
    expect(dated.documents.every((t) => t.dueDate && t.dueDate >= from && t.dueDate < to)).toBe(true);
    const undated = await list({ scope: "calendar", unscheduled: true, limit: 100 });
    expect(undated.documents.map((t) => t.name).sort()).toEqual(["Someday 0", "Someday 1", "Someday 2", "Someday 3", "Someday 4"]);
});

test("specific tasks by id, and server search with a limit", async () => {
    const some = (await list({ limit: 3 })).documents.map((t) => t.$id);
    const byId = await list({ ids: some.join(",") });
    expect(byId.documents.map((t) => t.$id).sort()).toEqual([...some].sort());
    const search = await list({ search: "Done 0", limit: 20 });
    expect(search.documents.length).toBe(20);
    expect(search.documents.every((t) => t.name.startsWith("Done 0"))).toBe(true);
});

test("Home's summary is counted on the server", async () => {
    const res = await user.api.get(`/api/tasks/summary?${new URLSearchParams({ workspaceId, ...week })}`);
    const summary = (await res.json()).data;
    expect(summary).toMatchObject({ total: 170, done: 105, inProgress: 0 });
    expect(summary.projects[0]).toMatchObject({ tasks: 170, doneTasks: 105 });
});

test("the browser table pages through them", async ({ browser, baseURL }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=table`, { timeout: 90_000 });
    await expect(page.getByText("Page 1 of 7")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("row")).toHaveCount(26);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Page 2 of 7")).toBeVisible();

    await page.getByRole("tab", { name: "Kanban" }).click();
    await expect(page.getByText(/Done shows the 100 most recently finished; 5 older ones are in the/)).toBeVisible({ timeout: 30_000 });
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});
