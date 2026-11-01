import { expect, request, test } from "@playwright/test";

import { createProject, createWorkspace, getMembers, registerUser, type TestUser } from "./helpers";

// API: oversized input and floods are refused before they reach slow work (hashing) or the database
test.describe.configure({ mode: "serial" });

let admin: TestUser;
let workspaceId: string;
let projectId: string;
let memberId: string;
let inviteCode: string;

const long = (n: number) => "x".repeat(n);

test("setup", async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Caps Admin");
    const workspace = await createWorkspace(admin.api, "Caps WS");
    workspaceId = workspace.$id;
    inviteCode = workspace.inviteCode;
    projectId = (await createProject(admin.api, workspaceId, "Caps Project")).$id;
    memberId = (await getMembers(admin.api, workspaceId))[0].$id;
});

test("sign-up and sign-in refuse oversized names and passwords", async ({ baseURL }) => {
    const anon = await request.newContext({ baseURL });
    const email = `caps-${Date.now()}@example.com`;
    expect((await anon.post("/api/auth/register", { data: { name: long(81), email, password: "correct-horse-battery" } })).status()).toBe(400);
    expect((await anon.post("/api/auth/register", { data: { name: "Caps", email, password: long(129) } })).status()).toBe(400);
    // Sign-in still accepts passwords set before the cap; only absurd sizes are refused outright
    expect((await anon.post("/api/auth/login", { data: { email: admin.email, password: long(200) } })).status()).toBe(401);
    expect((await anon.post("/api/auth/login", { data: { email: admin.email, password: long(100_000) } })).status()).toBe(400);
    await anon.dispose();

    expect((await admin.api.post("/api/account/password", { data: { currentPassword: admin.password, newPassword: long(129) } })).status()).toBe(400);
});

test("tasks, projects, routines and workspaces refuse oversized text", async () => {
    const task = { workspaceId, projectId, status: "TODO", assigneeIds: [memberId] };
    expect((await admin.api.post("/api/tasks", { data: { ...task, name: long(201) } })).status()).toBe(400);
    expect((await admin.api.post("/api/tasks", { data: { ...task, name: "ok", description: long(5001) } })).status()).toBe(400);
    expect((await admin.api.post("/api/tasks", { data: { ...task, name: long(200), description: long(5000) } })).status()).toBe(200);

    expect((await admin.api.post("/api/projects", { multipart: { name: long(201), workspaceId } })).status()).toBe(400);
    expect((await admin.api.post("/api/workspaces", { multipart: { name: long(101) } })).status()).toBe(400);
    expect((await admin.api.post("/api/routines", {
        data: { workspaceId, projectId, name: long(201), assigneeIds: [memberId], weekdays: [1] },
    })).status()).toBe(400);
});

test("ids longer than 64 characters are refused", async () => {
    expect((await admin.api.get(`/api/tasks?workspaceId=${long(65)}`)).status()).toBe(400);
    expect((await admin.api.get(`/api/members?workspaceId=${long(65)}`)).status()).toBe(400);
    expect((await admin.api.get(`/api/tasks?workspaceId=${workspaceId}&search=${long(201)}`)).status()).toBe(400);
});

// Counters are shared through the database; each test uses fresh accounts and IPs so runs don't collide
test("sign-up is limited to 5 accounts an hour per IP", async ({ baseURL }) => {
    const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}-${Date.now()}`;
    const anon = await request.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": ip } });
    const signUp = (i: number) => anon.post("/api/auth/register", {
        data: { name: "Flood", email: `flood-${Date.now()}-${i}@example.com`, password: "correct-horse-battery" },
    });
    for (let i = 0; i < 5; i++) expect((await signUp(i)).status()).toBe(200);
    const res = await signUp(5);
    expect(res.status()).toBe(429);
    expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
    expect((await res.json()).error).toMatch(/Try again in/);
    await anon.dispose();
});

test("guessing invite codes stops after 10 tries", async ({ baseURL }) => {
    const guesser = await registerUser(baseURL!, "Guesser");
    for (let i = 0; i < 10; i++) {
        expect((await guesser.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: `wrong${i}` } })).status()).not.toBe(429);
    }
    // Even the right code waits now
    expect((await guesser.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: inviteCode } })).status()).toBe(429);
});

test("change requests: a burst of 5, then a cooldown", async ({ baseURL }) => {
    const assignee = await registerUser(baseURL!, "Eager Assignee");
    expect((await assignee.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: inviteCode } })).status()).toBe(200);
    const ask = (i: number) => assignee.api.post("/api/change-requests", {
        data: { kind: "create", workspaceId, changes: { name: `Idea ${i}`, projectId, assigneeIds: [memberId] } },
    });
    // Invalid requests don't use up the allowance
    expect((await assignee.api.post("/api/change-requests", { data: { kind: "create", workspaceId, changes: { name: "" } } })).status()).toBe(400);
    for (let i = 0; i < 5; i++) {
        const res = await ask(i);
        expect(res.status(), await res.text()).toBe(200);
    }
    expect((await ask(5)).status()).toBe(429);
});

test("bulk input runs are limited to 10 an hour", async ({ baseURL }) => {
    const runner = await registerUser(baseURL!, "Bulk Runner");
    const ws = (await createWorkspace(runner.api, "Bulk Flood WS")).$id;
    const run = () => runner.api.post(`/api/workspaces/${ws}/bulk`, { data: { script: "project add \"P\"", apply: true } });
    for (let i = 0; i < 10; i++) expect((await run()).status()).not.toBe(429);
    expect((await run()).status()).toBe(429);
    // Checking (no apply) still works until its own, larger limit
    expect((await runner.api.post(`/api/workspaces/${ws}/bulk`, { data: { script: "project add \"P\"" } })).status()).not.toBe(429);
});

test("broken bodies are refused with 400, not a crash", async () => {
    const raw = (path: string, body: string) => admin.api.post(path, { headers: { "content-type": "application/json" }, data: body });
    for (const path of ["/api/tasks", "/api/routines", "/api/change-requests", `/api/workspaces/${workspaceId}/bulk`]) {
        const res = await raw(path, "{not json");
        expect(res.status(), path).toBe(400);
    }
    expect((await admin.api.post("/api/tasks", { data: { workspaceId, projectId, name: "x", status: "NOPE", assigneeIds: [memberId] } })).status()).toBe(400);
    expect((await admin.api.post("/api/tasks", { data: [1, 2, 3] })).status()).toBe(400);
});

test("another workspace's ids are refused", async ({ baseURL }) => {
    const outsider = await registerUser(baseURL!, "Outsider");
    const theirWs = (await createWorkspace(outsider.api, "Outsider WS")).$id;
    const theirProject = (await createProject(outsider.api, theirWs, "Theirs")).$id;
    const theirMember = (await getMembers(outsider.api, theirWs))[0].$id;

    // Reading or writing a workspace you're not in
    expect((await outsider.api.get(`/api/tasks?workspaceId=${workspaceId}`)).status()).toBe(401);
    expect((await outsider.api.post("/api/tasks", { data: { workspaceId, projectId, name: "Sneaky", status: "TODO", assigneeIds: [theirMember] } })).status()).toBe(401);
    // Mixing your workspace with another's project or member
    expect((await admin.api.post("/api/tasks", { data: { workspaceId, projectId: theirProject, name: "Cross", status: "TODO", assigneeIds: [memberId] } })).status()).toBeGreaterThanOrEqual(400);
    expect((await admin.api.post("/api/tasks", { data: { workspaceId, projectId, name: "Cross", status: "TODO", assigneeIds: [theirMember] } })).status()).toBeGreaterThanOrEqual(400);
    const tasks = (await (await admin.api.get(`/api/tasks?workspaceId=${workspaceId}&search=Cross`)).json()).data.documents;
    expect(tasks).toHaveLength(0);
});
