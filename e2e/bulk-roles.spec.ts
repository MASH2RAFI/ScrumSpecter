import { expect, test, type APIRequestContext } from "@playwright/test";

import { createProject, createWorkspace, getMembers, registerUser, type TestUser } from "./helpers";

// Bulk input for Reviewers and Assignees: their own task lines are saved, lines for anyone else
// become change requests (one notification per run), and everything else fails. Viewers: 403.
test.describe.configure({ mode: "serial" });

let admin: TestUser, assignee: TestUser, reviewer: TestUser, viewer: TestUser, hoarder: TestUser;
let workspace: { $id: string; inviteCode: string };
const ids: Record<string, string> = {};

const json = async (res: Awaited<ReturnType<APIRequestContext["get"]>>) => {
    const body = await res.json() as { data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    return body.data;
};
const run = (user: TestUser, script: string, apply = false) =>
    user.api.post(`/api/workspaces/${workspace.$id}/bulk`, { data: { script, apply } });
const findTask = async (name: string) =>
    (await json(await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&search=${encodeURIComponent(name)}`))).documents
        .find((task: { name: string }) => task.name === name);

test.beforeAll(async ({ baseURL }) => {
    [admin, assignee, reviewer, viewer, hoarder] = await Promise.all(
        ["Bea Admin", "Abe Assignee", "Rex Reviewer", "Val Viewer", "Hal Hoarder"].map((name) => registerUser(baseURL!, name)),
    );
    workspace = await createWorkspace(admin.api, "Bulk roles WS");
    await createProject(admin.api, workspace.$id, "Ops");
    for (const user of [assignee, reviewer, hoarder]) {
        expect((await user.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    }
    const full = await json(await admin.api.get(`/api/workspaces/${workspace.$id}`));
    expect((await viewer.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: full.viewerInviteCode } })).status()).toBe(200);
    for (const member of await getMembers(admin.api, workspace.$id)) ids[member.name] = member.$id;
    expect((await admin.api.patch(`/api/members/${ids[reviewer.name]}`, { data: { role: "REVIEWER" } })).status()).toBe(200);
});

test("viewers get 403", async () => {
    const res = await run(viewer, `task add "Peek" project:"Ops"`);
    expect(res.status()).toBe(403);
});

test("an assignee's own lines are saved, others' become requests with one notification", async () => {
    const script = [
        `task add "Mine A" project:"Ops"`,
        `task add "Mine B" project:"Ops" assignee:me due:tomorrow`,
        `task add "For Bea 1" project:"Ops" assignee:"${admin.name}" points:5`,
        `task add "For Bea 2" project:"Ops" assignee:"${admin.name}, me"`,
    ].join("\n");

    const checked = await json(await run(assignee, script));
    expect(checked.results.map((r: { outcome: string }) => r.outcome)).toEqual(["saved", "saved", "request", "request"]);

    const res = await run(assignee, script, true);
    expect(res.status(), await res.text()).toBe(200);
    const applied = await json(res);
    expect(applied.applied).toBe(true);
    expect(applied.counts).toEqual({ task: 2, request: 2 });

    expect(await findTask("Mine A")).toMatchObject({ assigneeIds: [ids[assignee.name]] });
    expect(await findTask("Mine B")).toBeTruthy();
    expect(await findTask("For Bea 1")).toBeUndefined();

    const requests = (await json(await admin.api.get(`/api/change-requests?workspaceId=${workspace.$id}`))).documents;
    const mine = requests.filter((r: { requesterName: string }) => r.requesterName === assignee.name);
    expect(mine.map((r: { taskName: string }) => r.taskName).sort()).toEqual(["For Bea 1", "For Bea 2"]);
    expect(mine.every((r: { kind: string; status: string }) => r.kind === "create" && r.status === "pending")).toBe(true);

    const titles = (await json(await admin.api.get("/api/notifications"))).documents.map((n: { title: string }) => n.title);
    expect(titles.filter((title: string) => title.includes("task request"))).toEqual([`${assignee.name} sent 2 task requests`]);

    // An admin approving a bulk-made request creates the task
    const forBea = mine.find((r: { taskName: string }) => r.taskName === "For Bea 1");
    expect((await admin.api.post(`/api/change-requests/${forBea.$id}/approve`, { data: {} })).status()).toBe(200);
    expect(await findTask("For Bea 1")).toMatchObject({ assigneeIds: [ids[admin.name]], storyPoints: 5 });
});

test("lines a single request couldn't do fail with a reason; reviewers too", async () => {
    for (const user of [assignee, reviewer]) {
        const body = await json(await run(user, [
            `project add "Side"`,
            `routine add "Daily" project:"Ops" days:daily`,
            `holiday add 2026-12-31 "Closed"`,
            `placeholder add "Temp"`,
            `task remove "Mine A"`,
        ].join("\n"), true));
        expect(body.applied).toBe(false);
        for (const result of body.results) {
            expect(result.ok).toBe(false);
            expect(result.error).toMatch(/^Only admins and supervisors can (add|remove) .*You can add tasks/);
        }
    }
    // A reviewer may start their own task at Done; an assignee's Done goes for approval
    expect((await json(await run(reviewer, `task add "Done already" project:"Ops" status:done`))).results[0].outcome).toBe("saved");
    expect((await json(await run(assignee, `task add "Done already" project:"Ops" status:done`))).results[0].outcome).toBe("request");
});

test("the pending cap covers the whole run, up front", async () => {
    const lines = Array.from({ length: 51 }, (_, i) => `task add "Ask ${i}" project:"Ops" assignee:"${admin.name}"`);
    const res = await run(hoarder, lines.join("\n"));
    expect(res.status()).toBe(429);
    expect((await res.json()).error).toMatch(/would send 51 more/);
    // Within the cap it's fine
    expect((await run(hoarder, lines.slice(0, 50).join("\n"))).status()).toBe(200);
});

test("a run of requests counts against the change request cooldown", async () => {
    // The assignee's run above used one of the 5 requests per 2 minutes
    const projectId = (await json(await admin.api.get(`/api/projects?workspaceId=${workspace.$id}`))).documents[0].$id;
    const ask = (i: number) => assignee.api.post("/api/change-requests", {
        data: { kind: "create", workspaceId: workspace.$id, changes: { name: `Single ${i}`, projectId, assigneeIds: [ids[admin.name]] } },
    });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await ask(i)).status());
    expect(statuses.slice(0, 4)).toEqual([200, 200, 200, 200]);
    expect(statuses[4]).toBe(429);
});
