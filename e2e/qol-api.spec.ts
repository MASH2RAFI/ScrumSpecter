import { createHash, createHmac, randomBytes } from "node:crypto";

import { expect, request, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, type TestUser, sql } from "./helpers";

// API: sign-in cookie and return paths, login lockout, password reset, safe Google linking,
// invite limits, bulk edit and restore
test.describe.configure({ mode: "serial" });

const LINK_SECRET = "e2e-link-secret";

test("the session cookie is SameSite=Lax; deep links ask to sign in and come back", async ({ baseURL }) => {
    const anon = await request.newContext({ baseURL });
    const email = `e2e-lax-${Date.now()}@example.com`;
    const res = await anon.post("/api/auth/register", { data: { name: "Lax", email, password: "correct-horse-battery" } });
    expect(res.headers()["set-cookie"]).toMatch(/SameSite=Lax/i);

    const deep = await anon.get("/workspaces/abc/tasks?task-view=kanban", { maxRedirects: 0, headers: { cookie: "" } });
    expect(deep.status()).toBe(307);
    expect(deep.headers().location).toBe("/sign-in?next=%2Fworkspaces%2Fabc%2Ftasks%3Ftask-view%3Dkanban");
    const home = await anon.get("/", { maxRedirects: 0, headers: { cookie: "" } });
    expect(home.headers().location).toBe("/about");
    await anon.dispose();
});

test("too many wrong passwords lock the account for a while", async ({ baseURL }) => {
    const victim = await registerUser(baseURL!, "Locked Lou");
    const bystander = await registerUser(baseURL!, "Fine Fay");
    const anon = await request.newContext({ baseURL });
    for (let i = 0; i < 10; i++) {
        expect((await anon.post("/api/auth/login", { data: { email: victim.email, password: "wrong-password" } })).status()).toBe(401);
    }
    // Locked: even the right password is refused, without saying whether it was right
    const locked = await anon.post("/api/auth/login", { data: { email: victim.email, password: victim.password } });
    expect(locked.status()).toBe(429);
    expect((await locked.json()).error).toMatch(/Too many attempts\. Try again in 15 minutes\./);
    // Another account is unaffected
    expect((await anon.post("/api/auth/login", { data: { email: bystander.email, password: bystander.password } })).status()).toBe(200);

    // Once the lock runs out, the right password works and the count starts over
    await sql("update login_attempts set locked_until = now() - interval '1 minute' where key = $1", [`email:${victim.email}`]);
    expect((await anon.post("/api/auth/login", { data: { email: victim.email, password: victim.password } })).status()).toBe(200);
    expect(await sql("select * from login_attempts where key = $1", [`email:${victim.email}`])).toHaveLength(0);
    await anon.dispose();
});

test("parallel wrong passwords can't all be checked before the lock lands", async ({ baseURL }) => {
    const victim = await registerUser(baseURL!, "Burst Bea");
    const anon = await request.newContext({ baseURL });
    const answers = await Promise.all(Array.from({ length: 15 }, () =>
        anon.post("/api/auth/login", { data: { email: victim.email, password: "wrong-password" } })));
    const statuses = answers.map((answer) => answer.status());
    // Ten guesses at most were checked (401); the rest were turned away unchecked (429)
    expect(statuses.filter((status) => status === 401).length).toBeLessThanOrEqual(10);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(5);
    expect((await anon.post("/api/auth/login", { data: { email: victim.email, password: victim.password } })).status()).toBe(429);
    await anon.dispose();
    // Every test client shares one address: don't leave this burst counted against the other tests
    await sql("delete from login_attempts where key like 'ip:%'");
});

test("correct sign-ins never count against the shared address", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Office Olly");
    // The address Vercel would report (the dev server sets none)
    const anon = await request.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": "198.51.100.77" } });
    await sql("delete from login_attempts where key = 'ip:198.51.100.77'");
    // More than the per-address limit (30 in 15 minutes): only wrong guesses may count
    for (let i = 0; i < 35; i++) {
        expect((await anon.post("/api/auth/login", { data: { email: user.email, password: user.password } })).status(), `sign-in ${i + 1}`).toBe(200);
    }
    expect(await sql("select failures from login_attempts where key = 'ip:198.51.100.77'")).toEqual([{ failures: 0 }]);
    await anon.dispose();
});

test("two sign-ups with one address at once: one wins, the other gets 409", async ({ baseURL }) => {
    const email = `e2e-double-${Date.now()}@example.com`;
    const anon = await request.newContext({ baseURL });
    const answers = await Promise.all([1, 2].map(() =>
        anon.post("/api/auth/register", { data: { name: "Double Dee", email, password: "correct-horse-battery" } })));
    expect(answers.map((answer) => answer.status()).sort()).toEqual([200, 409]);
    await anon.dispose();
});

test("the daily cron deletes stale rows and keeps the live ones", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Stale Stu");
    const [{ id: userId }] = await sql<{ id: string }>("select id from users where email = $1", [user.email]);
    const stale = `stale-${Date.now()}`;
    await sql("insert into login_attempts (key, failures, window_start) values ($1, 1, now() - interval '3 days'), ($2, 1, now())", [`email:${stale}-old`, `email:${stale}-new`]);
    await sql("insert into sessions (id, user_id, expires_at) values ($1, $2, now() - interval '1 day')", [`${stale}-session`, userId]);
    await sql("insert into email_verifications (id, user_id, expires_at) values ($1, $2, now() - interval '30 days')", [`${stale}-verify`, userId]);

    const anon = await request.newContext({ baseURL });
    const res = await anon.get("/api/cron/routines", { headers: { authorization: "Bearer e2e-cron-secret" } });
    expect(res.status()).toBe(200);
    expect((await res.json()).data.cleaned).toMatchObject({ sessions: expect.any(Number) });
    await anon.dispose();

    expect(await sql("select key from login_attempts where key like $1 order by key", [`email:${stale}-%`])).toEqual([{ key: `email:${stale}-new` }]);
    expect(await sql("select id from sessions where id = $1", [`${stale}-session`])).toHaveLength(0);
    expect(await sql("select id from email_verifications where id = $1", [`${stale}-verify`])).toHaveLength(0);
    // The live session still works
    expect((await user.api.get("/api/auth/current")).status()).toBe(200);
});

test("a password reset ends the secret calendar link", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Feed Fran");
    const workspace = await createWorkspace(user.api, "Feed WS");
    const link = (await (await user.api.post("/api/export/calendar-feed", { data: { workspaceId: workspace.$id } })).json()).data.url as string;
    const path = new URL(link).pathname;
    const anon = await request.newContext({ baseURL });
    // No sign-in needed: the key in the link is the check
    expect((await anon.get(path)).status()).toBe(200);

    const [{ id: userId }] = await sql<{ id: string }>("select id from users where email = $1", [user.email]);
    const token = randomBytes(32).toString("base64url");
    await sql("insert into password_resets (id, user_id, expires_at) values ($1, $2, now() + interval '30 minutes')",
        [createHash("sha256").update(token).digest("hex"), userId]);
    expect((await anon.post("/api/auth/reset-password", { data: { token, password: "a-brand-new-password" } })).status()).toBe(200);

    // The old link is dead
    expect((await anon.get(path)).status()).toBe(404);
    await anon.dispose();
});

test("routine tasks stop at the workspace's task cap", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Cap Cal");
    const workspace = await createWorkspace(admin.api, "Cap WS");
    const project = await createProject(admin.api, workspace.$id, "Capped", 14);
    const full = await createWorkspace(admin.api, "Not Full WS");
    const fullProject = await createProject(admin.api, full.$id, "Roomy", 14);
    // 20,000 tasks is the per-workspace cap
    await sql("insert into tasks (id, name, status, workspace_id, position) select 'cap-' || i, 'Filler', 'TODO', $1, i from generate_series(1, 20000) as i", [workspace.$id]);

    const routine = async (projectId: string, workspaceId: string) => admin.api.post("/api/routines", {
        data: { workspaceId, name: "Daily", projectId, assigneeIds: [(await getMembers(admin.api, workspaceId))[0].$id], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect((await routine(project.$id, workspace.$id)).status()).toBe(200);
    expect((await routine(fullProject.$id, full.$id)).status()).toBe(200);
    const anon = await request.newContext({ baseURL });
    expect((await anon.get("/api/cron/routines", { headers: { authorization: "Bearer e2e-cron-secret" } })).status()).toBe(200);
    await anon.dispose();

    const count = async (workspaceId: string) =>
        Number((await sql<{ n: string }>("select count(*) as n from tasks where workspace_id = $1 and routine_id is not null", [workspaceId]))[0].n);
    expect(await count(workspace.$id)).toBe(0);
    // A workspace with room is unaffected
    expect(await count(full.$id)).toBe(14);
});

test("forgot password: same answer for unknown emails; a reset link works once and signs others out", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Reset Rae");
    const anon = await request.newContext({ baseURL });

    const unknown = await anon.post("/api/auth/forgot-password", { data: { email: "nobody-here@example.com" } });
    const known = await anon.post("/api/auth/forgot-password", { data: { email: user.email } });
    expect(unknown.status()).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
    // Reset requests can't be used to lock someone out of signing in
    for (let i = 0; i < 6; i++) await anon.post("/api/auth/forgot-password", { data: { email: user.email } });
    expect((await anon.post("/api/auth/forgot-password", { data: { email: user.email } })).status()).toBe(429);
    expect((await anon.post("/api/auth/login", { data: { email: user.email, password: user.password } })).status()).toBe(200);
    await sql("delete from password_resets");

    const [{ id: userId }] = await sql<{ id: string }>("select id from users where email = $1", [user.email]);

    // The emailed token isn't readable here; a known one is planted the same way the server stores it
    const token = randomBytes(32).toString("base64url");
    await sql("insert into password_resets (id, user_id, expires_at) values ($1, $2, now() + interval '30 minutes')",
        [createHash("sha256").update(token).digest("hex"), userId]);

    expect((await anon.post("/api/auth/reset-password", { data: { token, password: "short" } })).status()).toBe(400);
    const reset = await anon.post("/api/auth/reset-password", { data: { token, password: "a-brand-new-password" } });
    expect(reset.status()).toBe(200);
    expect(reset.headers()["set-cookie"]).toMatch(/specter-session=/);

    expect((await user.api.get("/api/auth/current")).status()).toBe(401);
    expect((await anon.post("/api/auth/login", { data: { email: user.email, password: user.password } })).status()).toBe(401);
    expect((await anon.post("/api/auth/login", { data: { email: user.email, password: "a-brand-new-password" } })).status()).toBe(200);

    const again = await anon.post("/api/auth/reset-password", { data: { token, password: "another-new-password" } });
    expect(again.status()).toBe(400);

    const expired = randomBytes(32).toString("base64url");
    await sql("insert into password_resets (id, user_id, expires_at) values ($1, $2, now() - interval '1 minute')",
        [createHash("sha256").update(expired).digest("hex"), userId]);
    expect((await anon.post("/api/auth/reset-password", { data: { token: expired, password: "another-new-password" } })).status()).toBe(400);
    await anon.dispose();
});

// Same format as src/lib/pending-google-link.ts
const pendingLink = (sub: string, email: string, secret = LINK_SECRET) => {
    const payload = Buffer.from(JSON.stringify({ sub, email, exp: Date.now() + 600_000 })).toString("base64url");
    return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
};

test("Google links to an existing account only after its password is entered", async ({ baseURL }) => {
    const owner = await registerUser(baseURL!, "Owner Olu");
    const login = async (cookie: string) => {
        const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: `google-pending-link=${cookie}` } });
        const res = await ctx.post("/api/auth/login", { data: { email: owner.email, password: owner.password } });
        const result = { status: res.status(), body: await res.json(), setCookie: res.headers()["set-cookie"] ?? "" };
        await ctx.dispose();
        return result;
    };
    const googleId = async () => (await sql<{ google_id: string | null }>("select google_id from users where email = $1", [owner.email]))[0].google_id;

    // A forged or mismatched link changes nothing
    expect((await login(pendingLink("g-forged", owner.email, "wrong-secret"))).status).toBe(200);
    expect(await googleId()).toBeNull();
    expect((await login(pendingLink("g-other", "someone-else@example.com"))).status).toBe(200);
    expect(await googleId()).toBeNull();

    const linked = await login(pendingLink("g-owner-123", owner.email));
    expect(linked.body.googleLinked).toBe(true);
    expect(linked.setCookie).toMatch(/google-pending-link=;/);
    expect(await googleId()).toBe("g-owner-123");
});

test("invite links: expiry and use limits", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Invite Ivy");
    const [first, second, third] = await Promise.all([1, 2, 3].map((i) => registerUser(baseURL!, `Joiner ${i}`)));
    const workspace = await createWorkspace(admin.api, "Invite WS");
    const join = (who: TestUser, code = workspace.inviteCode) =>
        who.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code } });

    expect((await first.api.patch(`/api/workspaces/${workspace.$id}/invite`, { data: { expiresInDays: 1, maxUses: 1 } })).status()).toBe(401);
    expect((await admin.api.patch(`/api/workspaces/${workspace.$id}/invite`, { data: { expiresInDays: 2, maxUses: 1 } })).status()).toBe(400);
    const limited = await admin.api.patch(`/api/workspaces/${workspace.$id}/invite`, { data: { expiresInDays: 7, maxUses: 1 } });
    expect((await limited.json()).data).toMatchObject({ inviteMaxUses: 1, inviteUses: 0 });

    // One place, two people at once: only one gets in
    const results = await Promise.all([join(first), join(second)]);
    expect(results.map((r) => r.status()).sort()).toEqual([200, 400]);
    const loser = results[0].status() === 400 ? results[0] : results[1];
    expect((await loser.json()).error).toBe("This invite link has been used up");

    // A new link starts counting again
    const fresh = (await (await admin.api.post(`/api/workspaces/${workspace.$id}/reset-invite-code`)).json()).data;
    expect(fresh.inviteUses).toBe(0);
    await sql("update workspaces set invite_expires_at = now() - interval '1 minute' where id = $1", [workspace.$id]);
    const expired = await join(third, fresh.inviteCode);
    expect((await expired.json()).error).toBe("This invite link has expired");

    // Changing one limit leaves the other alone
    await admin.api.patch(`/api/workspaces/${workspace.$id}/invite`, { data: { maxUses: 5 } });
    expect((await join(third, fresh.inviteCode)).status()).toBe(400);
    expect((await admin.api.patch(`/api/workspaces/${workspace.$id}/invite`, { data: {} })).status()).toBe(400);
    await admin.api.patch(`/api/workspaces/${workspace.$id}/invite`, { data: { expiresInDays: null } });
    expect((await join(third, fresh.inviteCode)).status()).toBe(200);
});

test("bulk edit: one change for many tasks, member limits, and undo by restore", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Bulk Bea");
    const member = await registerUser(baseURL!, "Bulk Ben");
    const outsider = await registerUser(baseURL!, "Bulk Out");
    const workspace = await createWorkspace(admin.api, "Bulk WS");
    await member.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } });
    const project = await createProject(admin.api, workspace.$id, "Bulk project");
    const members = await getMembers(admin.api, workspace.$id);
    const adminMember = members.find((m) => m.role === "ADMIN")!.$id;
    const memberMember = members.find((m) => m.role === "ASSIGNEE")!.$id;

    const ids: string[] = [];
    for (const name of ["One", "Two", "Three"]) {
        const res = await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: adminMember, name });
        ids.push((await res.json()).data.$id);
    }
    const task = async (id: string) => (await (await admin.api.get(`/api/tasks/${id}`)).json()).data;

    let res = await admin.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { status: "IN_PROGRESS", assigneeIds: [memberMember] } } });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).data.previous.map((t: { status: string }) => t.status)).toEqual(["TODO", "TODO", "TODO"]);
    for (const id of ids) expect(await task(id)).toMatchObject({ status: "IN_PROGRESS", assigneeIds: [memberMember] });

    // Assignees: nothing in bulk; reviewers: status only
    expect((await member.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { status: "IN_REVIEW" } } })).status()).toBe(403);
    expect((await admin.api.patch(`/api/members/${memberMember}`, { data: { role: "REVIEWER" } })).status()).toBe(200);
    expect((await member.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { status: "IN_REVIEW" } } })).status()).toBe(200);
    expect((await member.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { assigneeIds: [adminMember] } } })).status()).toBe(403);
    expect((await member.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { delete: true } } })).status()).toBe(403);
    expect((await outsider.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { status: "DONE" } } })).status()).toBe(401);

    // Not across workspaces
    const otherWs = await createWorkspace(outsider.api, "Other");
    const otherProject = await createProject(outsider.api, otherWs.$id, "Elsewhere");
    const [otherMember] = await getMembers(outsider.api, otherWs.$id);
    const foreign = (await (await createTask(outsider.api, { workspaceId: otherWs.$id, projectId: otherProject.$id, assigneeId: otherMember.$id })).json()).data.$id;
    expect((await admin.api.post("/api/tasks/bulk-edit", { data: { ids: [...ids, foreign], changes: { status: "DONE" } } })).status()).toBe(400);
    expect((await admin.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { assigneeIds: [otherMember.$id] } } })).status()).toBe(400);

    // Delete, then undo
    res = await admin.api.post("/api/tasks/bulk-edit", { data: { ids, changes: { delete: true } } });
    const { previous } = (await res.json()).data;
    expect((await admin.api.get(`/api/tasks/${ids[0]}`)).status()).toBe(404);
    expect((await outsider.api.post("/api/tasks/restore", { data: { tasks: previous } })).status()).toBe(401);
    expect((await member.api.post("/api/tasks/restore", { data: { tasks: previous } })).status()).toBe(403);
    const restored = await admin.api.post("/api/tasks/restore", { data: { tasks: previous } });
    expect((await restored.json()).data.restored).toBe(3);
    expect(await task(ids[1])).toMatchObject({ name: "Two", status: "IN_REVIEW", assigneeIds: [memberMember] });
    // Restoring twice adds nothing
    expect((await (await admin.api.post("/api/tasks/restore", { data: { tasks: previous } })).json()).data.restored).toBe(0);
});

test("placeholder assignees: assign before joining, hand over on join or by hand", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Place Admin");
    const member = await registerUser(baseURL!, "Place Member");
    const workspace = await createWorkspace(admin.api, "Placeholder WS");
    const project = await createProject(admin.api, workspace.$id, "Launch");
    const newcomerEmail = `e2e-newcomer-${Date.now()}@example.com`;

    // Admins only
    expect((await member.api.post("/api/members/placeholders", { data: { workspaceId: workspace.$id, name: "Nope" } })).status()).toBe(401);
    const designer = (await (await admin.api.post("/api/members/placeholders", {
        data: { workspaceId: workspace.$id, name: "Designer (TBD)", email: newcomerEmail.toUpperCase() },
    })).json()).data;
    const writer = (await (await admin.api.post("/api/members/placeholders", { data: { workspaceId: workspace.$id, name: "Writer (TBD)" } })).json()).data;
    expect(designer).toMatchObject({ name: "Designer (TBD)", email: newcomerEmail, isPlaceholder: true, userId: null });

    // Listed after the people; tasks can be assigned to them
    const list = await getMembers(admin.api, workspace.$id);
    expect(list.map((m) => m.name)).toEqual(["Place Admin", "Designer (TBD)", "Writer (TBD)"]);
    const designTask = (await (await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: designer.$id, name: "Draw the logo" })).json()).data.$id;
    const writeTask = (await (await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: writer.$id, name: "Write copy" })).json()).data.$id;
    expect((await (await admin.api.get(`/api/tasks/${designTask}`)).json()).data.assignee).toMatchObject({ name: "Designer (TBD)", isPlaceholder: true });

    // Placeholders aren't people: no roles, and they don't make the admin "not the only member"
    expect((await admin.api.patch(`/api/members/${writer.$id}`, { data: { role: "ADMIN" } })).status()).toBe(400);
    expect((await admin.api.post("/api/members/leave-workspace", { data: { workspaceId: workspace.$id } })).status()).toBe(400);
    // Reminders and the Backlog sweep cope with placeholder assignees
    expect((await (await request.newContext({ baseURL })).get("/api/cron/reminders", { headers: { authorization: "Bearer e2e-cron-secret" } })).status()).toBe(200);

    // The newcomer joins with the placeholder's email: its tasks are theirs, the placeholder goes
    const newcomer = await (async () => {
        const anon = await request.newContext({ baseURL });
        const res = await anon.post("/api/auth/register", { data: { name: "New Nia", email: newcomerEmail, password: "correct-horse-battery" } });
        const cookie = res.headers()["set-cookie"].split(";")[0];
        await anon.dispose();
        return request.newContext({ baseURL, extraHTTPHeaders: { cookie } });
    })();
    expect((await newcomer.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    // Anyone can sign up with someone else's address: until it is verified the tasks stay put
    expect((await getMembers(admin.api, workspace.$id)).map((m) => m.name)).toContain("Designer (TBD)");
    expect((await (await admin.api.get(`/api/tasks/${designTask}`)).json()).data.assignee).toMatchObject({ name: "Designer (TBD)", isPlaceholder: true });
    // The emailed link proves the inbox: now they are handed over
    const [{ id: niaUserId }] = await sql<{ id: string }>("select id from users where email = $1", [newcomerEmail]);
    const verifyToken = randomBytes(32).toString("base64url");
    await sql("insert into email_verifications (id, user_id, expires_at) values ($1, $2, now() + interval '1 hour')",
        [createHash("sha256").update(verifyToken).digest("hex"), niaUserId]);
    const anonymous = await request.newContext({ baseURL });
    expect((await anonymous.post("/api/auth/verify-email", { data: { token: verifyToken } })).status()).toBe(200);
    await anonymous.dispose();
    const afterJoin = await getMembers(admin.api, workspace.$id);
    const nia = afterJoin.find((m) => m.name === "New Nia")!;
    expect(afterJoin.map((m) => m.name)).not.toContain("Designer (TBD)");
    expect((await (await admin.api.get(`/api/tasks/${designTask}`)).json()).data.assignee).toMatchObject({ $id: nia.$id, name: "New Nia" });

    // By hand: only into someone who has joined
    expect((await admin.api.post(`/api/members/${writer.$id}/replace`, { data: { memberId: writer.$id } })).status()).toBe(400);
    expect((await admin.api.post(`/api/members/${nia.$id}/replace`, { data: { memberId: nia.$id } })).status()).toBe(404);
    expect((await member.api.post(`/api/members/${writer.$id}/replace`, { data: { memberId: nia.$id } })).status()).toBe(401);
    expect((await admin.api.post(`/api/members/${writer.$id}/replace`, { data: { memberId: nia.$id } })).status()).toBe(200);
    expect((await (await admin.api.get(`/api/tasks/${writeTask}`)).json()).data.assignee.$id).toBe(nia.$id);

    // A removed placeholder's tasks go to an admin
    const temp = (await (await admin.api.post("/api/members/placeholders", { data: { workspaceId: workspace.$id, name: "Temp" } })).json()).data;
    const tempTask = (await (await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: temp.$id, name: "Temp work" })).json()).data.$id;
    expect((await admin.api.delete(`/api/members/${temp.$id}`)).status()).toBe(200);
    expect((await (await admin.api.get(`/api/tasks/${tempTask}`)).json()).data.assignee.name).toBe("Place Admin");
    await newcomer.dispose();
});

test("a removed or departed member's bell no longer shows that workspace's reminders", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Bell Boss");
    const kept = await registerUser(baseURL!, "Bell Kept");
    const fired = await registerUser(baseURL!, "Bell Fired");
    const quitter = await registerUser(baseURL!, "Bell Quit");
    const workspace = await createWorkspace(admin.api, "Bell WS");
    const other = await createWorkspace(admin.api, "Other Bell WS");
    for (const user of [kept, fired, quitter]) {
        expect((await user.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
        expect((await user.api.post(`/api/workspaces/${other.$id}/join`, { data: { code: other.inviteCode } })).status()).toBe(200);
    }
    const userId = async (email: string) => (await sql<{ id: string }>("select id from users where email = $1", [email]))[0].id;
    for (const user of [kept, fired, quitter]) {
        for (const workspaceId of [workspace.$id, other.$id]) {
            await sql("insert into notifications (id, user_id, workspace_id, kind, title, body, scheduled_for, dedupe_key) values ($1, $2, $3, 'before_end', 'Ends in 30 min: Secret', '', now(), $1)",
                [`bell-${workspaceId}-${await userId(user.email)}`, await userId(user.email), workspaceId]);
        }
    }

    const members = await getMembers(admin.api, workspace.$id);
    expect((await admin.api.delete(`/api/members/${members.find((m) => m.name === fired.name)!.$id}`)).status()).toBe(200);
    expect((await quitter.api.post("/api/members/leave-workspace", { data: { workspaceId: workspace.$id } })).status()).toBe(200);

    const bell = async (user: typeof kept) => (await sql<{ workspace_id: string }>("select workspace_id from notifications where user_id = $1 and title like 'Ends in 30 min: Secret'", [await userId(user.email)])).map((row) => row.workspace_id);
    // Gone for that workspace only; the other workspace and the people who stayed keep theirs
    expect(await bell(fired)).toEqual([other.$id]);
    expect(await bell(quitter)).toEqual([other.$id]);
    expect((await bell(kept)).sort()).toEqual([workspace.$id, other.$id].sort());
});

test("placeholders are also handed over when a password reset or a Google link verifies the address", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Verify Vera");
    const workspace = await createWorkspace(admin.api, "Verify WS");
    const project = await createProject(admin.api, workspace.$id, "Verify project");
    const taskOf = async (email: string) => {
        const placeholder = (await (await admin.api.post("/api/members/placeholders", { data: { workspaceId: workspace.$id, name: `Placeholder ${email}`, email } })).json()).data;
        const task = (await (await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: placeholder.$id, name: `Task for ${email}` })).json()).data.$id as string;
        return task;
    };
    const assignee = async (taskId: string) => (await (await admin.api.get(`/api/tasks/${taskId}`)).json()).data.assignee as { name: string; isPlaceholder?: boolean };

    // Two people join with unverified addresses a placeholder was made for: nothing moves yet
    const resetter = await registerUser(baseURL!, "Resetting Rex");
    const linker = await registerUser(baseURL!, "Linking Lia");
    const resetterTask = await taskOf(resetter.email);
    const linkerTask = await taskOf(linker.email);
    for (const user of [resetter, linker]) {
        expect((await user.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    }
    expect((await assignee(resetterTask)).isPlaceholder).toBe(true);
    expect((await assignee(linkerTask)).isPlaceholder).toBe(true);

    // A password reset proves the inbox: the address is verified and the tasks are handed over
    const [{ id: resetterId }] = await sql<{ id: string }>("select id from users where email = $1", [resetter.email]);
    const token = randomBytes(32).toString("base64url");
    await sql("insert into password_resets (id, user_id, expires_at) values ($1, $2, now() + interval '30 minutes')",
        [createHash("sha256").update(token).digest("hex"), resetterId]);
    const anon = await request.newContext({ baseURL });
    expect((await anon.post("/api/auth/reset-password", { data: { token, password: "a-brand-new-password" } })).status()).toBe(200);
    expect((await assignee(resetterTask)).name).toBe("Resetting Rex");

    // Signing in with the password while a Google link waits: Google vouched for the address
    const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: `google-pending-link=${pendingLink("g-linker-1", linker.email)}` } });
    expect((await ctx.post("/api/auth/login", { data: { email: linker.email, password: linker.password } })).status()).toBe(200);
    expect((await assignee(linkerTask)).name).toBe("Linking Lia");
    await ctx.dispose();
    await anon.dispose();
});

test("a lone admin with only placeholders can still delete their account", async ({ baseURL }) => {
    const solo = await registerUser(baseURL!, "Solo Sol");
    const workspace = await createWorkspace(solo.api, "Solo WS");
    await solo.api.post("/api/members/placeholders", { data: { workspaceId: workspace.$id, name: "Future hire" } });
    const res = await solo.api.delete("/api/account", { data: { confirmEmail: solo.email, password: solo.password } });
    expect(res.status(), await res.text()).toBe(200);
});

test("bulk input: checks every line, then applies all or nothing", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Bulk Admin");
    const member = await registerUser(baseURL!, "Bulk Member");
    const workspace = await createWorkspace(admin.api, "Bulk Input WS");
    await member.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } });
    const bulk = (who: TestUser, script: string, apply = false) =>
        who.api.post(`/api/workspaces/${workspace.$id}/bulk`, { data: { script, apply } });
    const counts = async () => (await sql<{ projects: string; tasks: string; routines: string; members: string }>(
        `select (select count(*) from projects where workspace_id = $1) as projects,
                (select count(*) from tasks where workspace_id = $1) as tasks,
                (select count(*) from routines where workspace_id = $1) as routines,
                (select count(*) from members where workspace_id = $1) as members`, [workspace.$id]))[0];

    // Members (assignees) may use bulk input, but not to add projects
    const asMember = await bulk(member, `project add "Nope"`);
    expect(asMember.status()).toBe(200);
    expect((await asMember.json()).data.results[0].ok).toBe(false);

    const script = [
        "# a comment",
        `project add "Launch" start:2026-11-01 end:2026-11-14`,
        `placeholder add "Designer (TBD)" email:designer@example.com`,
        `task add "Hero: banner" project:"launch" assignee:"Designer (TBD)" due:2026-11-03 time:10:00 duration:1.5h points:3`,
        `task add "Notes" project:"Launch" assignee:"Bulk Member" status:in_progress description:"Say \\"hi\\" to everyone"`,
        `routine add "Standup" project:"Launch" assignee:me days:sat,sun,mon time:09:30 duration:15`,
        `holiday add 2026-12-31 "Year end"`,
    ].join("\n");

    // A check writes nothing
    const before = await counts();
    const checked = (await (await bulk(admin, script)).json()).data;
    expect(checked.applied).toBe(false);
    expect(checked.results.map((r: { line: number; ok: boolean }) => [r.line, r.ok])).toEqual([[2, true], [3, true], [4, true], [5, true], [6, true], [7, true]]);
    expect(await counts()).toEqual(before);

    // One bad line: nothing is written, even with apply
    const broken = `${script}\ntask add "Orphan" project:"Missing"\ntask add Two words project:"Launch"\nroutine add "R" project:"Launch" days:funday\ntask add "T" project:"Launch" time:25:00 due:today\ntask add "U" project:"Launch" colour:red`;
    const failed = (await (await bulk(admin, broken, true)).json()).data;
    expect(failed.applied).toBe(false);
    expect(failed.results.filter((r: { ok: boolean }) => !r.ok).map((r: { error: string }) => r.error)).toEqual([
        'No project called "Missing"',
        'Put the task name in "quotes" (found 2 words)',
        `"funday" isn't a weekday; use sat, sun, mon, tue, wed, thu, fri`,
        `"25:00" isn't a time; use 24-hour HH:MM, e.g. 09:30`,
        'Unknown option "colour:" (allowed: project: assignee: status: due: time: duration: points: description:). Put names in "quotes".',
    ]);
    expect(await counts()).toEqual(before);

    // Valid: all of it lands
    const applied = (await (await bulk(admin, script, true)).json()).data;
    expect(applied.applied).toBe(true);
    expect(applied.counts).toEqual({ project: 1, placeholder: 1, task: 2, routine: 1, holiday: 1 });

    const tasks = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}`)).json()).data.documents as {
        name: string; startAt: string | null; durationMinutes: number | null; storyPoints: number; status: string; description: string | null;
        assignee: { name: string; isPlaceholder?: boolean } | null; routineId: string | null;
    }[];
    const hero = tasks.find((t) => t.name === "Hero: banner")!;
    // 10:00 in Dhaka (the author's default time zone) is 04:00 UTC
    expect(hero).toMatchObject({ startAt: "2026-11-03T04:00:00.000Z", durationMinutes: 90, storyPoints: 3, status: "TODO" });
    expect(hero.assignee).toMatchObject({ name: "Designer (TBD)", isPlaceholder: true });
    expect(tasks.find((t) => t.name === "Notes")).toMatchObject({ status: "IN_PROGRESS", description: 'Say "hi" to everyone', assignee: { name: "Bulk Member" } });

    // Names are now taken
    const again = (await (await bulk(admin, `project add "LAUNCH"`)).json()).data;
    expect(again.results[0].error).toBe('There\'s already a project called "LAUNCH"');
});
