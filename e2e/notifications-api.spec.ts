import { createECDH, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { join } from "node:path";

import { expect, request, test, type APIRequestContext } from "@playwright/test";

import { createProject, createTask, createWorkspace, CRON_SECRET, getMembers, registerUser, type TestUser } from "./helpers";

// API: reminders (6 PM summary, 30 min before the end), push delivery, and the To Do → Backlog rule.
// Users registered through the API keep the default time zone, Asia/Dhaka (UTC+6, no DST).
test.describe.configure({ mode: "serial" });

let cron: APIRequestContext;
let user: TestUser;
let other: TestUser;
let workspaceId: string;
let projectId: string;
let memberId: string;
let otherMemberId: string;

// YYYY-MM-DD in Dhaka, offset in days from today
const dhakaDay = (offset = 0) => new Date(Date.now() + 6 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
// An instant from Dhaka wall-clock time
const dhaka = (day: string, time: string) => new Date(`${day}T${time}:00+06:00`).toISOString();

const runAt = async (now?: string) => {
    const res = await cron.get(`/api/cron/reminders${now ? `?now=${encodeURIComponent(now)}` : ""}`, {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data as { created: number; pushed: number; movedToBacklog: number };
};

const reminders = async (who: TestUser) =>
    (await (await who.api.get("/api/notifications")).json()).data as {
        documents: { $id: string; kind: string; title: string; body: string; url: string | null; taskId: string | null; read: boolean }[];
        unread: number;
    };

const tomorrow = dhakaDay(1);

test("setup", async ({ baseURL }) => {
    cron = await request.newContext({ baseURL });
    user = await registerUser(baseURL!, "Reminder Rina");
    other = await registerUser(baseURL!, "Other Omar");
    const workspace = await createWorkspace(user.api, "Reminders WS");
    workspaceId = workspace.$id;
    projectId = (await createProject(user.api, workspaceId, "Ops", 14)).$id;
    expect((await other.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    const members = await getMembers(user.api, workspaceId);
    memberId = members.find((m) => m.name === "Reminder Rina")!.$id;
    otherMemberId = members.find((m) => m.name === "Other Omar")!.$id;
});

test("the cron endpoint needs the secret", async () => {
    expect((await cron.get("/api/cron/reminders")).status()).toBe(401);
    expect((await cron.get("/api/cron/reminders", { headers: { authorization: "Bearer nope" } })).status()).toBe(401);
});

test("30 minutes before a timed task ends, once", async () => {
    // Tomorrow 10:00–11:00 in Dhaka
    const created = await createTask(user.api, {
        workspaceId, projectId, assigneeId: memberId, name: "Design review",
        dueDate: dhaka(tomorrow, "00:00"), startAt: dhaka(tomorrow, "10:00"), durationMinutes: 60,
    });
    const taskId = (await created.json()).data.$id;

    await runAt(dhaka(tomorrow, "10:29"));
    expect((await reminders(user)).documents.filter((n) => n.taskId === taskId)).toHaveLength(0);

    await runAt(dhaka(tomorrow, "10:30"));
    let list = (await reminders(user)).documents.filter((n) => n.taskId === taskId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "before_end", title: "Ends in 30 min: Design review", read: false });
    expect(list[0].body).toBe("Ops · 10:00 AM – 11:00 AM");
    expect(list[0].url).toBe(`/workspaces/${workspaceId}?task=${taskId}`);

    // A later run inside the look-back window doesn't repeat it
    await runAt(dhaka(tomorrow, "10:35"));
    expect((await reminders(user)).documents.filter((n) => n.taskId === taskId)).toHaveLength(1);

    // Moved to 14:00–15:00: a new reminder for the new end
    await user.api.patch(`/api/tasks/${taskId}`, { data: { startAt: dhaka(tomorrow, "14:00") } });
    await runAt(dhaka(tomorrow, "14:30"));
    list = (await reminders(user)).documents.filter((n) => n.taskId === taskId);
    expect(list).toHaveLength(2);
    expect(list[0].body).toBe("Ops · 2:00 PM – 3:00 PM");
});

test("date-only tasks remind at 5:30 PM on their due date", async () => {
    const created = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "File report", dueDate: dhaka(tomorrow, "00:00") });
    const taskId = (await created.json()).data.$id;

    await runAt(dhaka(tomorrow, "17:29"));
    expect((await reminders(user)).documents.filter((n) => n.taskId === taskId)).toHaveLength(0);
    await runAt(dhaka(tomorrow, "17:30"));
    const [reminder] = (await reminders(user)).documents.filter((n) => n.taskId === taskId);
    expect(reminder).toMatchObject({ title: "Ends in 30 min: File report", body: "Ops · Due today by 6:00 PM" });
});

test("date-only tasks are due by the workspace's day end", async () => {
    expect((await user.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { workDayStart: "18:00", workDayEnd: "09:00" } })).status()).toBe(400);
    // Only the end changes: still checked against the stored start
    expect((await user.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { workDayEnd: "08:00" } })).status()).toBe(400);
    expect((await user.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { workDayEnd: "17:00" } })).status()).toBe(200);

    const day = dhakaDay(2);
    const created = await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Early finish", dueDate: dhaka(day, "00:00") });
    const taskId = (await created.json()).data.$id;
    await runAt(dhaka(day, "16:29"));
    expect((await reminders(user)).documents.filter((n) => n.taskId === taskId)).toHaveLength(0);
    await runAt(dhaka(day, "16:30"));
    const [reminder] = (await reminders(user)).documents.filter((n) => n.taskId === taskId);
    expect(reminder.body).toBe("Ops · Due today by 5:00 PM");

    // Back to the default for the tests that follow
    await user.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { workDayEnd: "18:00" } });
});

test("6 PM the day before: one summary of the assignee's tasks, skipping done ones", async () => {
    await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "Already done", status: "DONE", dueDate: dhaka(tomorrow, "00:00") });
    await createTask(user.api, { workspaceId, projectId, assigneeId: otherMemberId, name: "Omar's task", dueDate: dhaka(tomorrow, "00:00") });

    await runAt(dhaka(dhakaDay(0), "17:59"));
    expect((await reminders(user)).documents.filter((n) => n.kind === "day_before")).toHaveLength(0);

    await runAt(dhaka(dhakaDay(0), "18:00"));
    const [summary] = (await reminders(user)).documents.filter((n) => n.kind === "day_before");
    expect(summary).toMatchObject({ title: "Tomorrow: 2 tasks", body: "Design review, File report", url: `/workspaces/${workspaceId}/tasks` });

    const [omars] = (await reminders(other)).documents.filter((n) => n.kind === "day_before");
    expect(omars).toMatchObject({ title: "Tomorrow: 1 task", body: "Omar's task" });
});

test("reminders can be switched off", async () => {
    await other.api.patch("/api/account/preferences", { data: { remindDayBefore: false, remindBeforeEnd: false } });
    await createTask(user.api, { workspaceId, projectId, assigneeId: otherMemberId, name: "Quiet task", dueDate: dhaka(dhakaDay(2), "00:00") });
    await runAt(dhaka(dhakaDay(1), "18:00"));
    await runAt(dhaka(dhakaDay(2), "17:30"));
    expect((await reminders(other)).documents.map((n) => n.body).join()).not.toContain("Quiet task");
});

test("the bell: unread count, marking read, and privacy", async () => {
    const before = await reminders(user);
    expect(before.unread).toBeGreaterThan(0);
    // Someone else's ids are ignored
    await other.api.post("/api/notifications/read", { data: { ids: before.documents.map((n) => n.$id) } });
    expect((await reminders(user)).unread).toBe(before.unread);

    await user.api.post("/api/notifications/read", { data: { ids: [before.documents[0].$id] } });
    expect((await reminders(user)).unread).toBe(before.unread - 1);
    await user.api.post("/api/notifications/read", { data: {} });
    expect((await reminders(user)).unread).toBe(0);
});

test("push: delivered to a subscribed device; a gone device is forgotten", async () => {
    const received: { headers: Record<string, string | string[] | undefined>; bytes: number }[] = [];
    let respondWith = 201;
    const server: Server = createServer({
        key: readFileSync(join(__dirname, "fixtures/push-server.key")),
        cert: readFileSync(join(__dirname, "fixtures/push-server.crt")),
    }, (req, res) => {
        let bytes = 0;
        req.on("data", (chunk) => { bytes += chunk.length; });
        req.on("end", () => {
            received.push({ headers: req.headers, bytes });
            res.statusCode = respondWith;
            res.end();
        });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    // A browser's subscription: its P-256 public key and auth secret
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const subscription = {
        endpoint: `https://127.0.0.1:${port}/push/device-1`,
        keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
    };
    // Only browser push services are accepted as endpoints (the server POSTs to them)
    for (const endpoint of ["https://example.com/push", "http://fcm.googleapis.com/x", "https://10.0.0.5:8443/x"]) {
        expect((await user.api.post("/api/notifications/subscriptions", { data: { ...subscription, endpoint } })).status(), endpoint).toBe(400);
    }
    expect((await user.api.post("/api/notifications/subscriptions", { data: subscription })).status()).toBe(200);
    expect((await (await user.api.get("/api/notifications/subscriptions")).json()).data.devices).toBe(1);

    const test1 = await (await user.api.post("/api/notifications/test")).json();
    expect(test1.data.pushed).toBe(1);
    expect(received).toHaveLength(1);
    expect(received[0].headers["content-encoding"]).toBe("aes128gcm");
    expect(String(received[0].headers.authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(received[0].bytes).toBeGreaterThan(100);
    expect((await reminders(user)).documents[0].title).toBe("Notifications are working");

    // The push service says the device is gone
    respondWith = 410;
    expect((await (await user.api.post("/api/notifications/test")).json()).data.pushed).toBe(0);
    expect((await (await user.api.get("/api/notifications/subscriptions")).json()).data.devices).toBe(0);

    await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("tasks still in To Do after they end move to Backlog", async () => {
    const make = async (name: string, fields: Record<string, unknown>) =>
        (await (await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name, ...fields })).json()).data.$id as string;

    const yesterdayTodo = await make("Missed yesterday", { dueDate: dhaka(dhakaDay(-1), "00:00") });
    const startedYesterday = await make("Started yesterday", { status: "IN_PROGRESS", dueDate: dhaka(dhakaDay(-1), "00:00") });
    const endedBlock = await make("Ended an hour ago", {
        dueDate: new Date().toISOString(), startAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), durationMinutes: 60,
    });
    const runningBlock = await make("Still running", {
        dueDate: new Date().toISOString(), startAt: new Date(Date.now() - 10 * 60_000).toISOString(), durationMinutes: 60,
    });
    const unassigned = await (await createTask(user.api, { workspaceId, projectId, assigneeId: memberId, name: "No date", dueDate: undefined })).json();

    const { movedToBacklog } = await runAt();
    expect(movedToBacklog).toBeGreaterThanOrEqual(2);

    const status = async (id: string) => (await (await user.api.get(`/api/tasks/${id}`)).json()).data.status;
    expect(await status(yesterdayTodo)).toBe("BACKLOG");
    expect(await status(endedBlock)).toBe("BACKLOG");
    expect(await status(startedYesterday)).toBe("IN_PROGRESS");
    expect(await status(runningBlock)).toBe("TODO");
    expect(await status(unassigned.data.$id)).toBe("TODO");
});
