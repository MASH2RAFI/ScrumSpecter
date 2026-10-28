import { expect, request, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, CRON_SECRET, getMembers, registerUser, type TestUser } from "./helpers";

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
    expect(account.preferences).toEqual({
        defaultTaskView: "table", weekStart: 6, timeFormat: "12h", timeZone: "Asia/Dhaka", remindDayBefore: true, remindBeforeEnd: true, showTutorial: false, hiddenProjects: [],
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
