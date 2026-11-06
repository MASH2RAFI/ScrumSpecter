import { expect, request, test } from "@playwright/test";

import { createHash } from "node:crypto";

import { createProject, createTask, createWorkspace, CRON_SECRET, getMembers, registerUser, sql, type TestUser } from "./helpers";

// API: data versions, holidays (and routines skipping them), account settings
test.describe.configure({ mode: "serial" });

let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let workspaceId: string;
let projectId: string;
let adminMemberId: string;

const versions = async (user: TestUser) => (await (await user.api.get("/api/workspaces/versions")).json()).data.workspaces as Record<string, number>;
const userVersion = async (user: TestUser) => (await (await user.api.get("/api/workspaces/versions")).json()).data.user as number;

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test("setup", async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Holiday Admin");
    member = await registerUser(baseURL!, "Holiday Member");
    outsider = await registerUser(baseURL!, "Holiday Outsider");
    const workspace = await createWorkspace(admin.api, "Holiday WS");
    workspaceId = workspace.$id;
    projectId = (await createProject(admin.api, workspaceId, "Ops", 21)).$id;
    adminMemberId = (await getMembers(admin.api, workspaceId))[0].$id;
    expect((await member.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
});

test("data versions move on every change and are private", async () => {
    const before = (await versions(admin))[workspaceId];
    expect(before).toBeGreaterThan(0);

    const created = await createTask(admin.api, { workspaceId, projectId, assigneeId: adminMemberId, name: "Versioned" });
    const taskId = (await created.json()).data.$id;
    const afterCreate = (await versions(admin))[workspaceId];
    expect(afterCreate).toBeGreaterThan(before);

    await admin.api.patch(`/api/tasks/${taskId}`, { data: { name: "Versioned 2" } });
    const afterUpdate = (await versions(admin))[workspaceId];
    expect(afterUpdate).toBeGreaterThan(afterCreate);

    await admin.api.delete(`/api/tasks/${taskId}`);
    expect((await versions(admin))[workspaceId]).toBeGreaterThan(afterUpdate);

    // Members see the same version; outsiders don't see the workspace at all
    expect((await versions(member))[workspaceId]).toBe((await versions(admin))[workspaceId]);
    expect(workspaceId in await versions(outsider)).toBe(false);
});

test("public holidays for the workspace country", async () => {
    const res = await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-12-01&to=2026-12-31`);
    expect(res.status()).toBe(200);
    const { holidays, weekend, country } = (await res.json()).data;
    expect(country).toBe("BD");
    expect(holidays).toContainEqual({ date: "2026-12-16", name: "Victory Day", source: "public" });
    // Bangladesh: Friday and Saturday
    expect(weekend.sort()).toEqual([5, 6]);

    expect((await outsider.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-12-01&to=2026-12-31`)).status()).toBe(401);
    expect((await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-12-31&to=2026-12-01`)).status()).toBe(400);
});

test("routine tasks skip days off; removing the day off brings them back", async ({ baseURL }) => {
    const routineRes = await admin.api.post("/api/routines", {
        data: { workspaceId, name: "Daily check", projectId, assigneeIds: [adminMemberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    expect(routineRes.status()).toBe(200);

    const dayOff = isoDay(2);
    const tasksOn = async (date: string) => {
        const list = (await (await admin.api.get(`/api/tasks?workspaceId=${workspaceId}&search=Daily check`)).json()).data.documents;
        return list.filter((task: { dueDate: string }) => task.dueDate.slice(0, 10) === date);
    };
    expect(await tasksOn(dayOff)).toHaveLength(1);

    // Members can't change holidays
    expect((await member.api.post(`/api/workspaces/${workspaceId}/holidays`, { data: { date: dayOff, name: "Nope", kind: "custom" } })).status()).toBe(401);

    expect((await admin.api.post(`/api/workspaces/${workspaceId}/holidays`, { data: { date: dayOff, name: "Office closed", kind: "custom" } })).status()).toBe(200);
    expect(await tasksOn(dayOff)).toHaveLength(0);

    // The nightly job doesn't recreate it
    const anon = await request.newContext({ baseURL });
    expect((await anon.get("/api/cron/routines", { headers: { authorization: `Bearer ${CRON_SECRET}` } })).status()).toBe(200);
    await anon.dispose();
    expect(await tasksOn(dayOff)).toHaveLength(0);

    const listed = (await (await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=${dayOff}&to=${dayOff}`)).json()).data.holidays;
    expect(listed).toEqual([{ date: dayOff, name: "Office closed", source: "custom" }]);

    expect((await admin.api.delete(`/api/workspaces/${workspaceId}/holidays`, { data: { date: dayOff, kind: "custom" } })).status()).toBe(200);
    expect(await tasksOn(dayOff)).toHaveLength(1);
});

test("hiding a public holiday and switching country", async () => {
    const hide = await admin.api.post(`/api/workspaces/${workspaceId}/holidays`, { data: { date: "2026-12-16", name: "Victory Day", kind: "hidden" } });
    expect(hide.status()).toBe(200);
    const visible = (await (await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-12-16&to=2026-12-16`)).json()).data.holidays;
    expect(visible).toEqual([]);
    const withHidden = (await (await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-12-16&to=2026-12-16&includeHidden=true`)).json()).data.holidays;
    expect(withHidden).toEqual([{ date: "2026-12-16", name: "Victory Day", source: "public", hidden: true }]);

    expect((await admin.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { holidayCountry: "XX" } })).status()).toBe(400);
    expect((await admin.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { holidayCountry: "US" } })).status()).toBe(200);
    const us = (await (await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-07-04&to=2026-07-04`)).json()).data;
    expect(us.holidays.map((h: { name: string }) => h.name)).toContain("Independence Day");
    expect((await admin.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { holidayCountry: "" } })).status()).toBe(200);
    expect((await (await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-07-04&to=2026-07-04`)).json()).data.holidays).toEqual([]);
});

test("account: profile, preferences and sessions", async ({ baseURL }) => {
    let account = (await (await member.api.get("/api/account")).json()).data;
    expect(account).toMatchObject({ name: "Holiday Member", hasPassword: true, googleLinked: false, activeSessions: 1 });
    expect(account.preferences).toMatchObject({
        defaultTaskView: "table", weekStart: 6, timeFormat: "12h", timeZone: "Asia/Dhaka", remindDayBefore: true, remindBeforeEnd: true, showTutorial: false, hiddenProjects: [],
        // Newer settings start at their defaults
        landingPage: "home", theme: "device", reduceMotion: false, hiddenRoutineProjects: [],
    });

    expect((await member.api.patch("/api/account/profile", { data: { name: "Renamed Member" } })).status()).toBe(200);
    expect((await (await member.api.get("/api/auth/current")).json()).user.name).toBe("Renamed Member");
    // The admin sees the new name in the member list
    expect((await getMembers(admin.api, workspaceId)).map((m) => m.name)).toContain("Renamed Member");

    const wrong = await member.api.patch("/api/account/profile", { data: { email: "new@example.com", currentPassword: "nope-nope" } });
    expect(wrong.status()).toBe(400);
    expect((await wrong.json()).error).toBe("Current password is incorrect");
    const taken = await member.api.patch("/api/account/profile", { data: { email: admin.email, currentPassword: member.password } });
    expect((await taken.json()).error).toMatch(/already used/);

    const userBefore = await userVersion(member);
    const prefs = await member.api.patch("/api/account/preferences", { data: { weekStart: 1, timeFormat: "24h" } });
    // Other devices notice through the user version
    expect(await userVersion(member)).toBeGreaterThan(userBefore);
    expect((await prefs.json()).data).toMatchObject({ defaultTaskView: "table", weekStart: 1, timeFormat: "24h", timeZone: "Asia/Dhaka" });
    expect((await member.api.patch("/api/account/preferences", { data: { timeZone: "Mars/Base" } })).status()).toBe(400);
    expect((await (await member.api.get("/api/auth/current")).json()).user.preferences.weekStart).toBe(1);
    expect((await member.api.patch("/api/account/preferences", { data: { weekStart: 3 } })).status()).toBe(400);

    // A second sign-in, then "sign out other devices"
    const anon = await request.newContext({ baseURL });
    const login = await anon.post("/api/auth/login", { data: { email: member.email, password: member.password } });
    const otherCookie = login.headers()["set-cookie"].split(";")[0];
    const other = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: otherCookie } });
    account = (await (await member.api.get("/api/account")).json()).data;
    expect(account.activeSessions).toBe(2);
    expect((await (await member.api.post("/api/account/sessions/revoke-others")).json()).data.revoked).toBe(1);
    expect((await other.get("/api/auth/current")).status()).toBe(401);
    expect((await member.api.get("/api/auth/current")).status()).toBe(200);

    // Password change: old password stops working, other sessions end, this one stays
    const again = await anon.post("/api/auth/login", { data: { email: member.email, password: member.password } });
    const third = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: again.headers()["set-cookie"].split(";")[0] } });
    expect((await member.api.post("/api/account/password", { data: { currentPassword: "wrong-password", newPassword: "brand-new-pass" } })).status()).toBe(400);
    expect((await member.api.post("/api/account/password", { data: { currentPassword: member.password, newPassword: "brand-new-pass" } })).status()).toBe(200);
    expect((await third.get("/api/auth/current")).status()).toBe(401);
    expect((await member.api.get("/api/auth/current")).status()).toBe(200);
    expect((await anon.post("/api/auth/login", { data: { email: member.email, password: member.password } })).status()).toBe(401);
    expect((await anon.post("/api/auth/login", { data: { email: member.email, password: "brand-new-pass" } })).status()).toBe(200);
    member.password = "brand-new-pass";

    // No Google link to remove, and with a password it's allowed anyway
    expect((await member.api.delete("/api/account/google")).status()).toBe(200);
    await Promise.all([anon.dispose(), other.dispose(), third.dispose()]);
});

test("account deletion: blocked for the only admin of a shared workspace", async ({ baseURL }) => {
    const blocked = await admin.api.delete("/api/account", { data: { confirmEmail: admin.email, password: admin.password } });
    expect(blocked.status()).toBe(400);
    expect((await blocked.json()).error).toMatch(/Holiday WS/);

    expect((await member.api.delete("/api/account", { data: { confirmEmail: "someone@else.com", password: member.password } })).status()).toBe(400);

    // The member leaves by deleting their account; their routine tasks go to the admin
    const memberId = (await getMembers(admin.api, workspaceId)).find((m) => m.role === "ASSIGNEE")!.$id;
    const task = await createTask(admin.api, { workspaceId, projectId, assigneeId: memberId, name: "Hand over" });
    const taskId = (await task.json()).data.$id;
    const deleted = await member.api.delete("/api/account", { data: { confirmEmail: member.email, password: member.password } });
    expect(deleted.status(), await deleted.text()).toBe(200);
    expect((await member.api.get("/api/auth/current")).status()).toBe(401);
    expect((await getMembers(admin.api, workspaceId))).toHaveLength(1);
    expect((await (await admin.api.get(`/api/tasks/${taskId}`)).json()).data.assignee.$id).toBe(adminMemberId);

    // Now the admin is alone: deleting removes the workspace too
    expect((await admin.api.delete("/api/account", { data: { confirmEmail: admin.email, password: admin.password } })).status()).toBe(200);
    const anon = await request.newContext({ baseURL });
    expect((await anon.post("/api/auth/login", { data: { email: admin.email, password: admin.password } })).status()).toBe(401);
    await anon.dispose();
    expect((await outsider.api.get(`/api/workspaces/${workspaceId}/info`)).status()).toBe(404);
});

test("signed-in devices: listed with details, and signed out one at a time", async ({ baseURL }) => {
    const person = await registerUser(baseURL!, "Device Dana");
    const stranger = await registerUser(baseURL!, "Stranger Sam");
    const phone = await request.newContext({ baseURL, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" });
    const login = await phone.post("/api/auth/login", {
        data: { email: person.email, password: person.password },
        headers: { "x-real-ip": "203.0.113.7", "x-vercel-ip-city": "Dhaka", "x-vercel-ip-country": "BD" },
    });
    const phoneSession = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: login.headers()["set-cookie"].split(";")[0] } });

    const devices = (await (await person.api.get("/api/account/sessions")).json()).data as {
        id: string; userAgent: string | null; ipAddress: string | null; location: string | null; current: boolean;
    }[];
    expect(devices).toHaveLength(2);
    const self = devices.find((d) => d.current)!;
    const other = devices.find((d) => !d.current)!;
    expect(other).toMatchObject({ ipAddress: "203.0.113.7", location: "Dhaka, BD" });
    expect(other.userAgent).toContain("iPhone");

    // Not this device, not someone else's
    expect((await person.api.delete(`/api/account/sessions/${self.id}`)).status()).toBe(400);
    expect((await stranger.api.delete(`/api/account/sessions/${other.id}`)).status()).toBe(404);
    expect((await stranger.api.get("/api/account/sessions")).ok()).toBe(true);
    expect(((await (await stranger.api.get("/api/account/sessions")).json()).data as unknown[])).toHaveLength(1);

    expect((await phoneSession.get("/api/auth/current")).status()).toBe(200);
    expect((await person.api.delete(`/api/account/sessions/${other.id}`)).status()).toBe(200);
    expect((await phoneSession.get("/api/auth/current")).status()).toBe(401);
    expect((await person.api.get("/api/auth/current")).status()).toBe(200);
    expect(((await (await person.api.get("/api/account/sessions")).json()).data as unknown[])).toHaveLength(1);
    await Promise.all([phone.dispose(), phoneSession.dispose()]);
});

test("the notifications version moves when notifications are read, so other devices update their bell", async ({ baseURL }) => {
    // Its own account: the tests above sign the shared admin's devices in and out
    const admin = await registerUser(baseURL!, "Bell Bea");
    const notificationsVersion = async () => (await (await admin.api.get("/api/workspaces/versions")).json()).data.notifications as number;
    expect((await admin.api.post("/api/notifications/test")).status()).toBe(200);
    const created = await notificationsVersion();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await admin.api.post("/api/notifications/read", { data: {} })).status()).toBe(200);
    const read = await notificationsVersion();
    expect(read).toBeGreaterThan(created);
    // Reading again changes nothing: nothing was left unread
    expect((await admin.api.post("/api/notifications/read", { data: {} })).status()).toBe(200);
    expect(await notificationsVersion()).toBe(read);
});

test("saved filters of different workspaces are merged, not replaced; the limit still holds", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Filter Fay");
    const filter = (starred: boolean) => ({ people: [], statuses: [], starred, overdue: false });
    const save = (id: string, starred = false) => admin.api.patch("/api/account/preferences", { data: { taskFilters: { [id]: filter(starred) } } });
    const saved = async () => (await (await admin.api.get("/api/auth/current")).json()).user.preferences.taskFilters as Record<string, { starred: boolean }>;

    // Two devices, each saving a different workspace's filter from its own (stale) copy
    expect((await save("ws-one", true)).status()).toBe(200);
    expect((await save("ws-two")).status()).toBe(200);
    expect(Object.keys(await saved()).sort()).toEqual(["ws-one", "ws-two"]);
    expect((await saved())["ws-one"].starred).toBe(true);

    // Changing one entry leaves the other alone
    expect((await save("ws-two", true)).status()).toBe(200);
    expect(await saved()).toMatchObject({ "ws-one": { starred: true }, "ws-two": { starred: true } });

    // 50 workspaces are kept; one more is refused with a message
    for (let i = 3; i <= 50; i++) expect((await save(`ws-${i}`)).status()).toBe(200);
    const tooMany = await save("ws-51");
    expect(tooMany.status()).toBe(400);
    expect((await tooMany.json()).error).toMatch(/Too many saved filters/);
    expect(Object.keys(await saved())).toHaveLength(50);
});

test("a project's eye changes only that project; the list stays within its limit", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Eye Ede");
    const prefs = async () => (await (await user.api.get("/api/auth/current")).json()).user.preferences;
    const toggle = (list: string, id: string, hidden: boolean) =>
        user.api.patch("/api/account/preferences", { data: { hiddenToggle: { list, id, hidden } } });

    // Another device already hid "b"; this device's toggle of "a" keeps it
    expect((await user.api.patch("/api/account/preferences", { data: { hiddenProjects: ["b"] } })).status()).toBe(200);
    expect((await toggle("hiddenProjects", "a", true)).status()).toBe(200);
    expect([...(await prefs()).hiddenProjects].sort()).toEqual(["a", "b"]);
    // Twice is the same as once; the Routines list is its own
    expect((await toggle("hiddenProjects", "a", true)).status()).toBe(200);
    expect((await toggle("hiddenRoutineProjects", "c", true)).status()).toBe(200);
    expect((await toggle("hiddenProjects", "b", false)).status()).toBe(200);
    expect(await prefs()).toMatchObject({ hiddenProjects: ["a"], hiddenRoutineProjects: ["c"] });
    // The toggle itself is never stored
    expect(await prefs()).not.toHaveProperty("hiddenToggle");

    const full = Array.from({ length: 200 }, (_, i) => `p${i}`);
    expect((await user.api.patch("/api/account/preferences", { data: { hiddenProjects: full } })).status()).toBe(200);
    const over = await toggle("hiddenProjects", "one-more", true);
    expect(over.status()).toBe(400);
    expect((await over.json()).error).toMatch(/Too many hidden projects/);
    expect((await prefs()).hiddenProjects).toHaveLength(200);
});

test("deleting a project or workspace removes its saved filters from every account", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Prune Pru");
    const workspace = await createWorkspace(user.api, "Prune WS");
    const kept = await createProject(user.api, workspace.$id, "Kept");
    const doomed = await createProject(user.api, workspace.$id, "Doomed");
    const filter = { people: [], statuses: [], starred: false, overdue: false };
    const saved = async () => (await (await user.api.get("/api/auth/current")).json()).user.preferences;
    expect((await user.api.patch("/api/account/preferences", { data: {
        projectFilters: { [kept.$id]: filter, [doomed.$id]: filter },
        taskFilters: { [workspace.$id]: filter, other: filter },
        routineFilters: { [workspace.$id]: { people: [], tags: [] } },
        hiddenProjects: [doomed.$id, kept.$id], hiddenRoutineProjects: [doomed.$id],
    } })).status()).toBe(200);

    expect((await user.api.delete(`/api/projects/${doomed.$id}`)).status()).toBe(200);
    expect(Object.keys((await saved()).projectFilters)).toEqual([kept.$id]);
    // It no longer counts as hidden anywhere
    expect(await saved()).toMatchObject({ hiddenProjects: [kept.$id], hiddenRoutineProjects: [] });

    expect((await user.api.delete(`/api/workspaces/${workspace.$id}`)).status()).toBe(200);
    const after = await saved();
    expect(after.projectFilters).toEqual({});
    expect(Object.keys(after.taskFilters)).toEqual(["other"]);
    expect(after.routineFilters).toEqual({});
});

test("the calendar link keeps one key when asked many times at once", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Cal Cass");
    const workspace = await createWorkspace(user.api, "Cal WS");
    const ask = async (reset = false) => (await (await user.api.post("/api/export/calendar-feed", { data: { workspaceId: workspace.$id, reset } })).json()).data.url as string;

    // The first request of a new account, six times at the same moment: one key, one link
    const links = await Promise.all(Array.from({ length: 6 }, () => ask()));
    expect(new Set(links).size).toBe(1);
    expect(await ask()).toBe(links[0]);
    // Reset still makes a new one
    expect(await ask(true)).not.toBe(links[0]);
});

test("leaving a workspace, or being removed from it, clears that person's saved filters for it", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Own Olu");
    const workspace = await createWorkspace(admin.api, "Leave WS");
    const filter = { people: [], statuses: [], starred: false, overdue: false };
    const prefs = async (user: TestUser) => (await (await user.api.get("/api/auth/current")).json()).user.preferences;
    const mine = async (user: TestUser) => (await prefs(user)).taskFilters as Record<string, unknown>;
    const project = await createProject(admin.api, workspace.$id, "Leave project");
    const joinWithFilter = async (name: string) => {
        const user = await registerUser(baseURL!, name);
        expect((await user.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
        expect((await user.api.patch("/api/account/preferences", { data: {
            taskFilters: { [workspace.$id]: filter, elsewhere: filter },
            hiddenProjects: [project.$id, "elsewhere-project"], hiddenRoutineProjects: [project.$id],
        } })).status()).toBe(200);
        return user;
    };
    const leaver = await joinWithFilter("Lea Ver");
    const removed = await joinWithFilter("Rem Oved");

    expect((await leaver.api.post("/api/members/leave-workspace", { data: { workspaceId: workspace.$id } })).status()).toBe(200);
    expect(Object.keys(await mine(leaver))).toEqual(["elsewhere"]);
    // Its projects' eyes go too; another workspace's stay
    expect(await prefs(leaver)).toMatchObject({ hiddenProjects: ["elsewhere-project"], hiddenRoutineProjects: [] });

    const member = (await getMembers(admin.api, workspace.$id)).find((m) => m.name === "Rem Oved")!;
    expect((await admin.api.delete(`/api/members/${member.$id}`)).status()).toBe(200);
    expect(Object.keys(await mine(removed))).toEqual(["elsewhere"]);
    expect(await prefs(removed)).toMatchObject({ hiddenProjects: ["elsewhere-project"], hiddenRoutineProjects: [] });
});

test("a new email is not verified, and links sent for the old one stop working", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Verity Vee");
    const [{ id: userId }] = await sql<{ id: string }>("select id from users where email = $1", [user.email]);
    const token = "old-address-verification-token-0123456789";
    await sql("insert into email_verifications (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')",
        [createHash("sha256").update(token).digest("hex"), userId]);
    await sql("update users set email_verified_at = now() where id = $1", [userId]);
    const verified = async () => (await (await user.api.get("/api/auth/email-verification")).json()).data.verified as boolean;
    expect(await verified()).toBe(true);

    const changed = await user.api.patch("/api/account/profile", { data: { email: `moved-${Date.now()}@example.com`, currentPassword: user.password } });
    expect(changed.status(), await changed.text()).toBe(200);
    expect(await verified()).toBe(false);
    // The link sent for the old address cannot verify the new one
    const anon = await request.newContext({ baseURL });
    expect((await anon.post("/api/auth/verify-email", { data: { token } })).status()).toBe(400);
    expect(await verified()).toBe(false);

    // Changing only the name leaves things as they are
    await sql("update users set email_verified_at = now() where id = $1", [userId]);
    expect((await user.api.patch("/api/account/profile", { data: { name: "Verity V." } })).status()).toBe(200);
    expect(await verified()).toBe(true);
});

test("forgot password: the link is made after the answer, and a known address gets one", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Forgetful Fay");
    const [{ id: userId }] = await sql<{ id: string }>("select id from users where email = $1", [user.email]);
    const anon = await request.newContext({ baseURL });
    expect((await anon.post("/api/auth/forgot-password", { data: { email: user.email } })).status()).toBe(200);
    await expect.poll(async () => (await sql("select 1 from password_resets where user_id = $1", [userId])).length, { timeout: 10_000 }).toBe(1);
    // An unknown address gets the same answer and nothing is made
    expect((await anon.post("/api/auth/forgot-password", { data: { email: "nobody-at-all@example.com" } })).status()).toBe(200);
});

test("a project's sprint end can't be moved before its start (or the start after its end), one date at a time", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Sprint Sue");
    const workspace = await createWorkspace(user.api, "Sprint WS");
    const project = await createProject(user.api, workspace.$id, "Sprint project", 14);
    const dates = async () => {
        const body = (await (await user.api.get(`/api/projects/${project.$id}`)).json()).data;
        return { start: body.currentSprintStartDate as string, end: body.currentSprintEndDate as string };
    };
    const { start, end } = await dates();
    expect(start <= end).toBe(true);
    const patch = (fields: Record<string, string>) => user.api.patch(`/api/projects/${project.$id}`, { multipart: { workspaceId: workspace.$id, ...fields } });
    const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

    const early = await patch({ currentSprintEndDate: shift(start, -1) });
    expect(early.status(), await early.text()).toBe(400);
    expect((await early.json()).error).toMatch(/can't be before the start/);
    const late = await patch({ currentSprintStartDate: shift(end, 1) });
    expect(late.status(), await late.text()).toBe(400);
    expect(await dates()).toEqual({ start, end });

    // A valid one-date change still works, and so does the same day
    expect((await patch({ currentSprintEndDate: shift(end, 7) })).status()).toBe(200);
    expect((await patch({ currentSprintEndDate: start })).status()).toBe(200);
    expect(await dates()).toEqual({ start, end: start });
});

test("a workspace holds at most 500 members, placeholders included", async ({ baseURL }) => {
    test.setTimeout(120_000);
    const admin = await registerUser(baseURL!, "Crowd Cleo");
    const workspace = await createWorkspace(admin.api, "Crowd WS");
    const add = (n: number) => admin.api.post("/api/members/placeholders", { data: { workspaceId: workspace.$id, name: `Stand-in ${n}` } });

    // The admin is member 1: 499 placeholders fill it
    for (let start = 0; start < 499; start += 50) {
        const batch = await Promise.all(Array.from({ length: Math.min(50, 499 - start) }, (_, i) => add(start + i)));
        for (const res of batch) expect(res.status(), await res.text()).toBe(200);
    }
    expect((await getMembers(admin.api, workspace.$id))).toHaveLength(500);

    const over = await add(500);
    expect(over.status()).toBe(409);
    expect((await over.json()).error).toMatch(/at most 500 members/);
    // Joining is refused the same way
    const newcomer = await registerUser(baseURL!, "Late Lena");
    const join = await newcomer.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } });
    expect(join.status()).toBe(409);
    // ...and through the read-only link too
    const full = (await (await admin.api.get(`/api/workspaces/${workspace.$id}`)).json()).data;
    const viewerJoin = await newcomer.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: full.viewerInviteCode } });
    expect(viewerJoin.status(), await viewerJoin.text()).toBe(409);
    expect((await getMembers(admin.api, workspace.$id))).toHaveLength(500);
});

test("holidays: a made-up date is a 400, and a workspace holds at most 1000 days", async ({ baseURL }) => {
    test.setTimeout(120_000);
    const admin = await registerUser(baseURL!, "Holi Hana");
    const workspace = await createWorkspace(admin.api, "Holidays WS");
    const url = `/api/workspaces/${workspace.$id}/holidays`;
    const day = (offset: number) => new Date(Date.UTC(2030, 0, 1) + offset * 86_400_000).toISOString().slice(0, 10);

    // The right shape, but not days on the calendar: refused with a message, not a server error
    for (const date of ["2026-02-30", "2026-13-45", "2026-00-10"]) {
        const bad = await admin.api.post(url, { data: { date, name: "Nope", kind: "custom" } });
        expect(bad.status(), date).toBe(400);
        expect((await bad.json()).error).toBeTruthy();
        expect((await admin.api.delete(url, { data: { date, kind: "custom" } })).status(), date).toBe(400);
    }
    expect((await admin.api.post(url, { data: { date: "2026-02-28", name: "Real day", kind: "custom" } })).status()).toBe(200);

    // 999 more fill it (the same day twice is one row)
    for (let start = 0; start < 999; start += 50) {
        const batch = await Promise.all(Array.from({ length: Math.min(50, 999 - start) }, (_, i) =>
            admin.api.post(url, { data: { date: day(start + i), name: `Day ${start + i}`, kind: "custom" } })));
        for (const res of batch) expect(res.status(), await res.text()).toBe(200);
    }
    const over = await admin.api.post(url, { data: { date: day(5000), name: "One too many", kind: "custom" } });
    expect(over.status()).toBe(409);
    expect((await over.json()).error).toMatch(/at most 1,000 holidays/);
});

test("batch: several GETs in one request, each answered as if it came alone, and nothing else runs", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Batch Bo");
    const outsider = await registerUser(baseURL!, "Batch Outsider");
    const workspace = await createWorkspace(user.api, "Batch WS");
    await createProject(user.api, workspace.$id, "Batch project");
    const batch = async (who: TestUser, requests: unknown) => who.api.post("/api/batch", { data: { requests } });
    const paths = [`/api/projects?workspaceId=${workspace.$id}`, `/api/members?workspaceId=${workspace.$id}`, `/api/workspaces/${workspace.$id}`, "/api/auth/current"];

    // The same answers as asking one by one
    const res = await batch(user, paths);
    expect(res.status(), await res.text()).toBe(200);
    const { results } = await res.json() as { results: { status: number; type: string; body: string }[] };
    expect(results).toHaveLength(paths.length);
    for (const [index, path] of paths.entries()) {
        const alone = await user.api.get(path);
        expect(results[index].status, path).toBe(alone.status());
        expect(JSON.parse(results[index].body), path).toEqual(await alone.json());
    }

    // A full batch (more than the few that run at once) comes back whole and in order
    const full = Array.from({ length: 24 }, (_, index) => (index % 2 ? "/api/auth/current" : `/api/projects?workspaceId=${workspace.$id}`));
    const fullRes = await batch(user, full);
    expect(fullRes.status(), await fullRes.text()).toBe(200);
    const fullResults = (await fullRes.json()).results as { status: number; body: string }[];
    expect(fullResults).toHaveLength(24);
    fullResults.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.includes("\"documents\""), `result ${index}`).toBe(index % 2 === 0);
    });

    // A long list of hidden projects makes a long address: the batch still runs
    const longPath = `/api/projects?workspaceId=${workspace.$id}&${Array.from({ length: 100 }, () => `excludeProjects=${workspace.$id}`).join("&")}`;
    expect(longPath.length).toBeGreaterThan(2000);
    const long = await batch(user, [longPath, "/api/auth/current"]);
    expect(long.status(), await long.text()).toBe(200);

    // Someone who isn't a member gets the same refusal as asking alone
    const refused = (await (await batch(outsider, [`/api/projects?workspaceId=${workspace.$id}`])).json()).results[0];
    expect(refused.status).toBe(401);

    // Only the listed GET endpoints: everything else is refused and not run
    const forbidden = ["/api/auth/logout", "/api/auth/login", "/api/batch", "/api/cron/reminders", "/api/export/tasks?workspaceId=x", "/api/health",
        "/api/../api/auth/logout", "https://evil.example/api/projects", "//evil.example/api/projects", "/api/projects/../auth/logout"];
    const blocked = (await (await batch(user, forbidden)).json()).results as { status: number }[];
    expect(blocked.map((r) => r.status)).toEqual(forbidden.map(() => 400));
    expect((await user.api.get("/api/auth/current")).status()).toBe(200);

    // Needs a session, a sane body, and a sane size
    const anon = await request.newContext({ baseURL });
    expect((await anon.post("/api/batch", { data: { requests: ["/api/auth/current"] } })).status()).toBe(401);
    expect((await batch(user, [])).status()).toBe(400);
    expect((await batch(user, "nope")).status()).toBe(400);
    expect((await batch(user, Array.from({ length: 25 }, () => "/api/auth/current"))).status()).toBe(400);
    expect((await batch(user, Array.from({ length: 24 }, () => "/api/auth/current"))).status()).toBe(200);
});

test("lists carry only the start of a long description; the task itself has all of it", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Long Lena");
    const workspace = await createWorkspace(user.api, "Long WS");
    const project = await createProject(user.api, workspace.$id, "Long project");
    const [me] = await getMembers(user.api, workspace.$id);
    const long = "word ".repeat(300).trim();
    const make = async (name: string, description: string) => {
        const res = await createTask(user.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name, description });
        expect(res.status(), await res.text()).toBe(200);
        return (await res.json()).data.$id as string;
    };
    const longId = await make("Long one", long);
    // An emoji (two characters) that straddles the cut is left out, not cut in half
    const emojiId = await make("Emoji one", `${"a".repeat(399)}😀 and more words after it`);
    const shortId = await make("Short one", "just a line");

    const list = (await (await user.api.get(`/api/tasks?workspaceId=${workspace.$id}`)).json()).data.documents as { $id: string; description: string }[];
    const inList = (id: string) => list.find((task) => task.$id === id)!.description;
    expect(inList(longId)).toBe(`${long.slice(0, 400)}…`);
    expect(inList(shortId)).toBe("just a line");
    expect(inList(emojiId)).toBe(`${"a".repeat(399)}…`);
    // The task itself, and what its form edits, is whole
    const whole = (await (await user.api.get(`/api/tasks/${longId}`)).json()).data;
    expect(whole.description).toBe(long);
});
