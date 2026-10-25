import { expect, request, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, CRON_SECRET, getMembers, registerUser, type TestUser } from "./helpers";

// API regression: auth, workspace isolation, roles, validation, task times, routines and the cron job.
// Each test builds on the state left by the previous ones.
test.describe.configure({ mode: "serial" });

let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let workspace: { $id: string; inviteCode: string };
let project: { $id: string };
let adminMemberId: string;
let memberMemberId: string;
let taskId: string;

test("unauthenticated requests are rejected", async ({ baseURL }) => {
    const anon = await request.newContext({ baseURL });
    expect((await anon.get("/api/auth/current")).status()).toBe(401);
    expect((await anon.get("/api/workspaces")).status()).toBe(401);
    await anon.dispose();
});

test("register, current user and login", async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Admin Ada");
    member = await registerUser(baseURL!, "Member Max");
    outsider = await registerUser(baseURL!, "Outsider Oz");

    const current = await (await admin.api.get("/api/auth/current")).json();
    expect(current.user).toMatchObject({ name: "Admin Ada", email: admin.email });

    const anon = await request.newContext({ baseURL });
    const duplicate = await anon.post("/api/auth/register", { data: { name: "Again", email: admin.email, password: admin.password } });
    expect(duplicate.status()).toBeGreaterThanOrEqual(400);
    expect((await anon.post("/api/auth/login", { data: { email: admin.email, password: "wrong-password" } })).status()).toBe(401);
    expect((await anon.post("/api/auth/login", { data: { email: admin.email.toUpperCase(), password: admin.password } })).status()).toBe(200);
    await anon.dispose();
});

test("create workspace and project", async () => {
    workspace = await createWorkspace(admin.api);
    expect(workspace.inviteCode).toMatch(/^[A-Za-z0-9]{6}$/);
    project = await createProject(admin.api, workspace.$id);

    const list = await (await admin.api.get("/api/workspaces")).json();
    expect(list.data.documents.map((w: { $id: string }) => w.$id)).toContain(workspace.$id);

    const [adminMember] = await getMembers(admin.api, workspace.$id);
    expect(adminMember.role).toBe("ADMIN");
    adminMemberId = adminMember.$id;
});

test("sprint end before start is rejected", async () => {
    const res = await admin.api.post("/api/projects", {
        multipart: { name: "Backwards", workspaceId: workspace.$id, currentSprintStartDate: "2026-05-10", currentSprintEndDate: "2026-05-01" },
    });
    expect(res.status()).toBe(400);
});

test("outsiders cannot read the workspace", async () => {
    for (const path of [
        `/api/workspaces/${workspace.$id}`,
        `/api/projects?workspaceId=${workspace.$id}`,
        `/api/members?workspaceId=${workspace.$id}`,
        `/api/tasks?workspaceId=${workspace.$id}`,
        `/api/routines?workspaceId=${workspace.$id}`,
    ]) {
        expect((await outsider.api.get(path)).status(), path).toBe(401);
    }
});

test("join by invite code", async () => {
    expect((await member.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: "WRONG1" } })).status()).toBe(400);
    expect((await member.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    expect((await member.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(400);

    const members = await getMembers(admin.api, workspace.$id);
    expect(members).toHaveLength(2);
    memberMemberId = members.find((m) => m.role === "MEMBER")!.$id;
});

test("tasks: create, validation and cross-workspace references", async () => {
    const created = await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: memberMemberId, name: "Write tests" });
    expect(created.status(), await created.text()).toBe(200);
    taskId = (await created.json()).data.$id;

    const zeroPoints = await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: memberMemberId, storyPoints: 0 });
    expect(zeroPoints.status()).toBe(400);

    // A project from another workspace can't be attached
    const otherWorkspace = await createWorkspace(outsider.api, "Other");
    const otherProject = await createProject(outsider.api, otherWorkspace.$id);
    const foreign = await createTask(admin.api, { workspaceId: workspace.$id, projectId: otherProject.$id, assigneeId: memberMemberId });
    expect(foreign.status()).toBe(400);
    expect((await outsider.api.get(`/api/tasks/${taskId}`)).status()).toBe(401);
});

test("members can change status but not other fields, and can't create tasks", async () => {
    const forbidden = await createTask(member.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: memberMemberId });
    expect(forbidden.status()).toBe(403);

    const res = await member.api.patch(`/api/tasks/${taskId}`, { data: { status: "IN_PROGRESS", name: "Renamed by member" } });
    expect(res.status()).toBe(200);
    const task = (await res.json()).data;
    expect(task.status).toBe("IN_PROGRESS");
    expect(task.name).toBe("Write tests");

    expect((await member.api.delete(`/api/tasks/${taskId}`)).status()).toBe(403);
});

test("task time blocks round-trip and clear", async () => {
    const startAt = "2026-11-02T03:00:00.000Z";
    let res = await admin.api.patch(`/api/tasks/${taskId}`, { data: { startAt, durationMinutes: 90 } });
    expect(res.status()).toBe(200);
    let task = (await (await admin.api.get(`/api/tasks/${taskId}`)).json()).data;
    expect(task.startAt).toBe(startAt);
    expect(task.durationMinutes).toBe(90);
    expect(task.project.$id).toBe(project.$id);
    expect(task.assignee.name).toBe("Member Max");

    expect((await admin.api.patch(`/api/tasks/${taskId}`, { data: { durationMinutes: 2 } })).status()).toBe(400);

    res = await admin.api.patch(`/api/tasks/${taskId}`, { data: { startAt: null, durationMinutes: null } });
    task = (await res.json()).data;
    expect(task.startAt).toBeNull();
    expect(task.durationMinutes).toBeNull();
});

test("task list filters and search", async () => {
    await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: adminMemberId, name: "Deploy pipeline" });
    const all = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}`)).json()).data;
    expect(all.total).toBe(2);
    const search = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&search=deploy`)).json()).data;
    expect(search.documents.map((t: { name: string }) => t.name)).toEqual(["Deploy pipeline"]);
    const byStatus = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&status=IN_PROGRESS`)).json()).data;
    expect(byStatus.documents.map((t: { $id: string }) => t.$id)).toEqual([taskId]);
});

test("bulk update moves tasks and refuses mixed workspaces", async () => {
    const res = await member.api.post("/api/tasks/bulk-update", { data: { tasks: [{ $id: taskId, status: "IN_REVIEW", position: 2000 }] } });
    expect(res.status()).toBe(200);
    expect((await res.json()).data[0]).toMatchObject({ status: "IN_REVIEW", position: 2000 });
    expect((await outsider.api.post("/api/tasks/bulk-update", { data: { tasks: [{ $id: taskId, status: "DONE", position: 1000 }] } })).status()).toBe(401);
});

test("routines generate tasks through the sprint end at the routine's local time", async () => {
    expect((await member.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name: "Nope", projectId: project.$id, assigneeId: memberMemberId, weekdays: [1] },
    })).status()).toBe(403);

    const res = await admin.api.post("/api/routines", {
        data: {
            workspaceId: workspace.$id, name: "Standup", projectId: project.$id, assigneeId: memberMemberId,
            weekdays: [1, 2, 3, 4, 5, 6, 7], storyPoints: 1, startTime: "09:00", timeZone: "Asia/Dhaka", durationMinutes: 15,
        },
    });
    expect(res.status(), await res.text()).toBe(200);
    const routine = (await res.json()).data;

    const tasks = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&search=Standup`)).json()).data.documents;
    // 14-day sprint starting today, every weekday
    expect(tasks).toHaveLength(14);
    for (const task of tasks) {
        // 09:00 in Dhaka (UTC+6) is 03:00 UTC
        expect(new Date(task.startAt).getUTCHours()).toBe(3);
        expect(task.durationMinutes).toBe(15);
        expect(task.routineId).toBe(routine.$id);
    }

    // Re-timing moves upcoming tasks; switching to all day clears them
    await admin.api.patch(`/api/routines/${routine.$id}`, { data: { startTime: "10:30" } });
    let retimed = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&search=Standup`)).json()).data.documents;
    expect(retimed.every((task: { startAt: string }) => new Date(task.startAt).getUTCHours() === 4 && new Date(task.startAt).getUTCMinutes() === 30)).toBe(true);

    await admin.api.patch(`/api/routines/${routine.$id}`, { data: { startTime: null, durationMinutes: null } });
    retimed = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&search=Standup`)).json()).data.documents;
    expect(retimed.every((task: { startAt: string | null }) => task.startAt === null)).toBe(true);
    expect(retimed).toHaveLength(14);

    expect((await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name: "Bad zone", projectId: project.$id, assigneeId: memberMemberId, weekdays: [1], timeZone: "Mars/Olympus" },
    })).status()).toBe(400);
});

test("cron endpoint requires the secret and is idempotent", async ({ baseURL }) => {
    const anon = await request.newContext({ baseURL });
    expect((await anon.get("/api/cron/routines")).status()).toBe(401);
    expect((await anon.get("/api/cron/routines", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
    const res = await anon.get("/api/cron/routines", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.created).toBe(0);
    await anon.dispose();
});

test("roles: the only admin can't leave; promotion and leaving reassign tasks", async () => {
    expect((await admin.api.post("/api/members/leave-workspace", { data: { workspaceId: workspace.$id } })).status()).toBe(400);
    expect((await member.api.patch(`/api/members/${adminMemberId}`, { data: { role: "MEMBER" } })).status()).toBe(401);
    expect((await admin.api.patch(`/api/members/${adminMemberId}`, { data: { role: "MEMBER" } })).status()).toBe(400);

    expect((await member.api.post("/api/members/leave-workspace", { data: { workspaceId: workspace.$id } })).status()).toBe(200);
    const task = (await (await admin.api.get(`/api/tasks/${taskId}`)).json()).data;
    expect(task.assignee.$id).toBe(adminMemberId);
    expect((await member.api.get(`/api/tasks?workspaceId=${workspace.$id}`)).status()).toBe(401);
});

test("logout ends the session", async () => {
    expect((await outsider.api.post("/api/auth/logout")).status()).toBe(200);
    expect((await outsider.api.get("/api/auth/current")).status()).toBe(401);
});

test("deleting a workspace removes its data", async () => {
    const res = await admin.api.delete(`/api/workspaces/${workspace.$id}`);
    expect(res.status()).toBe(200);
    expect((await admin.api.get(`/api/tasks/${taskId}`)).status()).toBe(404);
});
