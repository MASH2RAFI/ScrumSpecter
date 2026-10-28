import { expect, test, type APIRequestContext } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, type TestUser } from "./helpers";

// API: roles (Admin, Supervisor, Reviewer, Assignee, Viewer), several assignees per task, the
// viewer invite link, and change requests
test.describe.configure({ mode: "serial" });

let admin: TestUser, supervisor: TestUser, reviewer: TestUser, assignee: TestUser, other: TestUser, viewer: TestUser;
let workspace: { $id: string; inviteCode: string };
let projectId: string;
const ids: Record<string, string> = {};

const json = async (res: Awaited<ReturnType<APIRequestContext["get"]>>) => {
    const body = await res.json() as { data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    return body.data;
};

test.beforeAll(async ({ baseURL }) => {
    [admin, supervisor, reviewer, assignee, other, viewer] = await Promise.all(
        ["Rae Admin", "Sam Supervisor", "Rita Reviewer", "Ada Assignee", "Otto Other", "Vic Viewer"].map((name) => registerUser(baseURL!, name)),
    );
    workspace = await createWorkspace(admin.api, "Roles WS");
    projectId = (await createProject(admin.api, workspace.$id, "Roles project")).$id;
    for (const user of [supervisor, reviewer, assignee, other]) {
        expect((await user.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    }
    const members = await getMembers(admin.api, workspace.$id);
    for (const [key, user] of Object.entries({ admin, supervisor, reviewer, assignee, other })) {
        ids[key] = members.find((member) => member.name === user.name)!.$id;
    }
    // The regular link joins as Assignee
    expect(members.filter((member) => member.role === "ASSIGNEE")).toHaveLength(4);
    expect((await admin.api.patch(`/api/members/${ids.supervisor}`, { data: { role: "SUPERVISOR" } })).status()).toBe(200);
    expect((await admin.api.patch(`/api/members/${ids.reviewer}`, { data: { role: "REVIEWER" } })).status()).toBe(200);
});

test("the viewer link joins as a viewer; only admins reset it", async ({ baseURL }) => {
    const full = await json(await admin.api.get(`/api/workspaces/${workspace.$id}`));
    expect(full.viewerInviteCode).toBeTruthy();
    expect((await viewer.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: full.viewerInviteCode } })).status()).toBe(200);
    const me = (await getMembers(admin.api, workspace.$id)).find((member) => member.name === viewer.name)!;
    expect(me.role).toBe("VIEWER");
    ids.viewer = me.$id;

    expect((await supervisor.api.post(`/api/workspaces/${workspace.$id}/reset-viewer-invite-code`)).status()).toBe(401);
    const reset = await json(await admin.api.post(`/api/workspaces/${workspace.$id}/reset-viewer-invite-code`));
    expect(reset.viewerInviteCode).not.toBe(full.viewerInviteCode);
    // The old viewer link no longer works
    const late = await registerUser(baseURL!, "Late Viewer");
    expect((await late.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: full.viewerInviteCode } })).status()).toBe(400);
    // Only admins change roles
    expect((await supervisor.api.patch(`/api/members/${ids.assignee}`, { data: { role: "REVIEWER" } })).status()).toBe(401);
});

test("several assignees: create, show, filter, and drop a removed member", async () => {
    const res = await createTask(supervisor.api, {
        workspaceId: workspace.$id, projectId, name: "Pair work", assigneeIds: [ids.assignee, ids.other, ids.assignee],
    });
    expect(res.status(), await res.text()).toBe(200);
    const task = await json(res);
    expect(task.assigneeIds).toEqual([ids.assignee, ids.other]);
    ids.pair = task.$id;

    const full = await json(await admin.api.get(`/api/tasks/${task.$id}`));
    expect(full.assignees.map((a: { name: string }) => a.name)).toEqual([assignee.name, other.name]);
    const filtered = await json(await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&assigneeId=${ids.other}`));
    expect(filtered.documents.map((t: { $id: string }) => t.$id)).toContain(task.$id);

    // At least one, at most 20, all from this workspace
    expect((await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeIds: [] })).status()).toBe(400);
    expect((await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeIds: [ids.assignee, "nope"] })).status()).toBe(400);
});

test("who may create, edit and delete", async () => {
    for (const user of [reviewer, assignee, viewer]) {
        expect((await createTask(user.api, { workspaceId: workspace.$id, projectId, assigneeId: ids.assignee })).status()).toBe(403);
        expect((await user.api.patch(`/api/tasks/${ids.pair}`, { data: { name: "Renamed" } })).status()).toBe(403);
        expect((await user.api.delete(`/api/tasks/${ids.pair}`)).status()).toBe(403);
    }
    expect((await supervisor.api.patch(`/api/tasks/${ids.pair}`, { data: { assigneeIds: [ids.assignee, ids.other, ids.reviewer] } })).status()).toBe(200);
    // Settings stay with admins
    expect((await supervisor.api.patch(`/api/workspaces/${workspace.$id}`, { multipart: { name: "Taken over" } })).status()).toBe(401);
});

test("the review step: assignees go up to In Review, reviewers approve to Done", async () => {
    const status = (user: TestUser, value: string) => user.api.patch(`/api/tasks/${ids.pair}`, { data: { status: value } });
    const solo = await json(await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: ids.other, name: "Not yours" }));

    expect((await status(assignee, "IN_PROGRESS")).status()).toBe(200);
    expect((await status(assignee, "IN_REVIEW")).status()).toBe(200);
    const done = await status(assignee, "DONE");
    expect(done.status()).toBe(403);
    expect((await done.json()).error).toMatch(/reviewer approves/);
    expect((await assignee.api.patch(`/api/tasks/${solo.$id}`, { data: { status: "IN_PROGRESS" } })).status()).toBe(403);
    expect((await status(viewer, "TODO")).status()).toBe(403);

    // Any task, any status, for reviewers
    expect((await status(reviewer, "DONE")).status()).toBe(200);
    // Once done, it's reviewers' to reopen
    expect((await status(assignee, "IN_PROGRESS")).status()).toBe(403);
    expect((await reviewer.api.patch(`/api/tasks/${solo.$id}`, { data: { status: "IN_PROGRESS" } })).status()).toBe(200);

    // Kanban moves follow the same rules; viewers can't even reorder
    const move = (user: TestUser, to: string) => user.api.post("/api/tasks/bulk-update", { data: { tasks: [{ $id: ids.pair, status: to, position: 1000 }] } });
    expect((await move(assignee, "IN_REVIEW")).status()).toBe(403);
    expect((await move(viewer, "DONE")).status()).toBe(403);
    expect((await move(reviewer, "IN_REVIEW")).status()).toBe(200);
});

test("bulk input: supervisors add tasks with several assignees, but not holidays", async () => {
    const run = (user: TestUser, script: string, apply = false) =>
        user.api.post(`/api/workspaces/${workspace.$id}/bulk`, { data: { script, apply } });
    const script = `task add "Bulk pair" project:"Roles project" assignee:"${assignee.name}, ${other.email}"`;
    const res = await run(supervisor, script, true);
    expect(res.status(), await res.text()).toBe(200);
    expect((await json(res)).applied).toBe(true);
    const found = await json(await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&search=Bulk pair`));
    expect(found.documents[0].assigneeIds.sort()).toEqual([ids.assignee, ids.other].sort());

    const holiday = await json(await run(supervisor, `holiday add 2026-12-31 "Closed"`));
    expect(holiday.results[0]).toMatchObject({ ok: false, error: "Only admins can add holidays" });
    expect((await run(assignee, script)).status()).toBe(403);
});

test("change requests: ask, review, apply, and tell", async () => {
    const requests = async (user: TestUser) =>
        (await json(await user.api.get(`/api/change-requests?workspaceId=${workspace.$id}`))).documents as { $id: string; status: string; requesterName: string }[];
    const ask = (user: TestUser, body: Record<string, unknown>) => user.api.post("/api/change-requests", { data: body });

    // A new task
    let res = await ask(assignee, {
        kind: "create", workspaceId: workspace.$id, note: "Found a bug",
        changes: { name: "Fix the login bug", projectId, assigneeIds: [ids.assignee], storyPoints: 2, dueDate: new Date().toISOString() },
    });
    expect(res.status(), await res.text()).toBe(200);
    const create = await json(res);
    expect(create).toMatchObject({ kind: "create", status: "pending", taskName: "Fix the login bug", requesterName: assignee.name });

    // A change and a deletion of existing tasks
    const update = await json(await ask(assignee, { kind: "update", taskId: ids.pair, changes: { name: "Pair programming", storyPoints: 5 } }));
    const remove = await json(await ask(reviewer, { kind: "delete", taskId: ids.pair, note: "Duplicate" }));

    // Bad requests
    expect((await ask(assignee, { kind: "update", taskId: ids.pair, changes: {} })).status()).toBe(400);
    expect((await ask(assignee, { kind: "update", taskId: ids.pair, changes: { assigneeIds: ["nope"] } })).status()).toBe(400);
    expect((await ask(viewer, { kind: "delete", taskId: ids.pair })).status()).toBe(403);
    expect((await ask(supervisor, { kind: "delete", taskId: ids.pair })).status()).toBe(403);

    // Editors see every request and were notified; requesters see only their own
    expect((await requests(supervisor)).map((r) => r.$id)).toEqual(expect.arrayContaining([create.$id, update.$id, remove.$id]));
    expect((await requests(assignee)).map((r) => r.$id).sort()).toEqual([create.$id, update.$id].sort());
    expect(await requests(viewer)).toEqual([]);
    const bell = await json(await admin.api.get("/api/notifications"));
    expect(bell.documents.map((n: { title: string }) => n.title)).toContain(`${assignee.name} wants to add "Fix the login bug"`);

    // Only editors review
    expect((await reviewer.api.post(`/api/change-requests/${create.$id}/approve`, { data: {} })).status()).toBe(403);

    // Approving applies it
    res = await supervisor.api.post(`/api/change-requests/${create.$id}/approve`, { data: { note: "Thanks!" } });
    expect(res.status(), await res.text()).toBe(200);
    const approved = await json(res);
    expect(approved).toMatchObject({ status: "approved", reviewerName: supervisor.name, reviewNote: "Thanks!" });
    const created = await json(await admin.api.get(`/api/tasks/${approved.taskId}`));
    expect(created).toMatchObject({ name: "Fix the login bug", status: "TODO", storyPoints: 2, assigneeIds: [ids.assignee] });
    // Once only
    expect((await admin.api.post(`/api/change-requests/${create.$id}/approve`, { data: {} })).status()).toBe(409);
    expect((await admin.api.post(`/api/change-requests/${create.$id}/decline`, { data: {} })).status()).toBe(409);

    res = await admin.api.post(`/api/change-requests/${update.$id}/approve`, { data: {} });
    expect(res.status(), await res.text()).toBe(200);
    expect(await json(await admin.api.get(`/api/tasks/${ids.pair}`))).toMatchObject({ name: "Pair programming", storyPoints: 5 });

    // Declining changes nothing; the requester hears either way
    expect((await admin.api.post(`/api/change-requests/${remove.$id}/decline`, { data: { note: "Still needed" } })).status()).toBe(200);
    expect((await admin.api.get(`/api/tasks/${ids.pair}`)).status()).toBe(200);
    const assigneeBell = (await json(await assignee.api.get("/api/notifications"))).documents.map((n: { title: string }) => n.title);
    expect(assigneeBell).toEqual(expect.arrayContaining(['Approved: add "Fix the login bug"', 'Approved: change "Pair work"']));
    const reviewerBell = (await json(await reviewer.api.get("/api/notifications"))).documents;
    expect(reviewerBell[0]).toMatchObject({ title: 'Declined: delete "Pair work"', body: "Still needed", kind: "change_reviewed" });

    // A requester can take back a request nobody has reviewed, and only their own
    const again = await json(await ask(assignee, { kind: "delete", taskId: ids.pair }));
    expect((await other.api.delete(`/api/change-requests/${again.$id}`)).status()).toBe(403);
    expect((await assignee.api.delete(`/api/change-requests/${again.$id}`)).status()).toBe(200);
    expect((await assignee.api.delete(`/api/change-requests/${update.$id}`)).status()).toBe(409);

    // Approving a deletion deletes the task
    const last = await json(await ask(assignee, { kind: "delete", taskId: ids.pair }));
    expect((await admin.api.post(`/api/change-requests/${last.$id}/approve`, { data: {} })).status()).toBe(200);
    expect((await admin.api.get(`/api/tasks/${ids.pair}`)).status()).toBe(404);
});
