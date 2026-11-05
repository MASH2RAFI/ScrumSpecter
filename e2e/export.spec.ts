import { expect, request, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, sql, type TestUser } from "./helpers";

// API: exports (TODO §14): tasks CSV and calendar, the bulk-input script round trip, the backup
// and personal data, and who may take each
test.describe.configure({ mode: "serial" });

let admin: TestUser, member: TestUser, outsider: TestUser;
let workspaceId: string;
let projectId: string;
let adminId: string;

const tomorrow = new Date(Date.now() + 86_400_000);

test.beforeAll(async ({ baseURL }) => {
    [admin, member, outsider] = await Promise.all(["Ana Admin", "Mo Member", "Oz Outsider"].map((name) => registerUser(baseURL!, name)));
    const workspace = await createWorkspace(admin.api, "Export WS");
    workspaceId = workspace.$id;
    projectId = (await createProject(admin.api, workspaceId, "Export project")).$id;
    expect((await member.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    const people = await getMembers(admin.api, workspaceId);
    const memberId = people.find((m) => m.name === member.name)!.$id;
    adminId = people.find((m) => m.name === admin.name)!.$id;

    for (const fields of [
        { name: "Plain export task", description: "Line one\nLine two, with \"quotes\"", assigneeIds: [memberId], dueDate: null },
        { name: "=HYPERLINK(\"http://evil\")", description: "@cmd", dueDate: null },
        { name: "All-day export task", dueDate: tomorrow.toISOString() },
        { name: "Timed export task", dueDate: tomorrow.toISOString(), startAt: tomorrow.toISOString(), durationMinutes: 90 },
    ]) {
        const res = await createTask(admin.api, { workspaceId, projectId, assigneeIds: [adminId], ...fields });
        expect(res.status(), await res.text()).toBe(200);
    }
});

test("tasks CSV: header, rows, filters and formula escaping", async () => {
    const res = await admin.api.get(`/api/export/tasks?workspaceId=${workspaceId}&format=csv`);
    expect(res.status(), await res.text()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const lines = (await res.text()).replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("Name,Project,Status,Assignees,Due date,Time,Duration (min),Points,Description,Routine,Created,Updated");
    const csv = lines.join("\n");
    expect(csv).toContain(`Plain export task,Export project,TODO,${member.name}`);
    // Quotes doubled, the line break kept inside the quoted cell
    expect(csv).toContain("\"Line one\nLine two, with \"\"quotes\"\"\"");
    // Formula-looking cells are prefixed with ' so spreadsheets keep them as text
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csv).toContain(",'@cmd,");
    expect(csv).toContain("Timed export task");
    expect(csv).toMatch(/Timed export task,[^\n]*,\d\d:\d\d,90,/);

    // The table's filters apply
    const filtered = await (await admin.api.get(`/api/export/tasks?workspaceId=${workspaceId}&format=csv&search=All-day`)).text();
    expect(filtered).toContain("All-day export task");
    expect(filtered).not.toContain("Plain export task");
});

test("a non-member can't export; a member can't take the admin exports", async () => {
    expect((await outsider.api.get(`/api/export/tasks?workspaceId=${workspaceId}&format=csv`)).status()).toBe(401);
    expect((await outsider.api.get(`/api/export/tasks?workspaceId=${workspaceId}&format=ics`)).status()).toBe(401);
    expect((await outsider.api.get(`/api/export/workspaces/${workspaceId}/backup`)).status()).toBe(401);
    expect((await member.api.get(`/api/export/workspaces/${workspaceId}/backup`)).status()).toBe(403);
    expect((await member.api.get(`/api/export/workspaces/${workspaceId}/bulk-script`)).status()).toBe(403);
    expect((await member.api.get(`/api/export/tasks?workspaceId=${workspaceId}&format=csv`)).status()).toBe(200);
});

test("calendar .ics: all-day tasks as VALUE=DATE, timed ones in UTC", async () => {
    const res = await admin.api.get(`/api/export/tasks?workspaceId=${workspaceId}&format=ics&scope=calendar`);
    expect(res.status(), await res.text()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const ics = await res.text();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    // Unfold continuation lines before reading events
    const events = ics.replace(/\r\n /g, "").split("BEGIN:VEVENT").slice(1);
    // Only scheduled tasks
    expect(events).toHaveLength(2);
    const allDay = events.find((event) => event.includes("SUMMARY:All-day export task"))!;
    expect(allDay).toMatch(/DTSTART;VALUE=DATE:\d{8}\r\n/);
    expect(allDay).toMatch(/DTEND;VALUE=DATE:\d{8}\r\n/);
    const timed = events.find((event) => event.includes("SUMMARY:Timed export task"))!;
    expect(timed).toMatch(/DTSTART:\d{8}T\d{6}Z\r\n/);
    const start = timed.match(/DTSTART:(\d{8}T\d{6}Z)/)![1];
    const end = timed.match(/DTEND:(\d{8}T\d{6}Z)/)![1];
    const parse = (value: string) => Date.parse(value.replace(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/, "$1-$2-$3T$4:$5:$6Z"));
    expect(parse(end) - parse(start)).toBe(90 * 60_000);
    // Every line is at most 75 octets
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
});

test("the bulk-input script pastes back into Bulk setup without errors", async () => {
    const routine = await admin.api.post("/api/routines", {
        data: { workspaceId, projectId, name: "Export standup", assigneeIds: [adminId], weekdays: [1, 3, 5], startTime: "09:30", durationMinutes: 15 },
    });
    expect(routine.status(), await routine.text()).toBe(200);
    const res = await admin.api.get(`/api/export/workspaces/${workspaceId}/bulk-script`);
    expect(res.status(), await res.text()).toBe(200);
    const script = await res.text();
    expect(script).toContain("project add \"Export project\"");
    expect(script).toContain(`placeholder add "${member.name}"`);
    expect(script).toContain("routine add \"Export standup\" project:\"Export project\" assignee:\"me\" days:mon,wed,fri time:09:30 duration:15");
    // Its generated tasks aren't listed; the routine makes them again
    expect(script).not.toMatch(/task add "Export standup"/);
    expect(script).toContain("task add \"=HYPERLINK(\\\"http://evil\\\")\"");
    expect(script).toMatch(/task add "Timed export task" [^\n]* due:\d{4}-\d\d-\d\d time:\d\d:\d\d duration:90/);

    const check = await admin.api.post("/api/workspaces/setup", { data: { name: "Copy of Export WS", script, apply: false } });
    expect(check.status(), await check.text()).toBe(200);
    const { results } = (await check.json()).data as { results: { ok: boolean; text: string; error?: string }[] };
    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(6);
});

test("a workspace past its task cap is still exported and backed up in full", async ({ baseURL }) => {
    // The cap can be passed by a few hundred (races, the last chunk of a routine run)
    const boss = await registerUser(baseURL!, "Over Cap");
    const full = await createWorkspace(boss.api, "Over cap WS");
    await sql("insert into tasks (id, name, status, workspace_id, position, due_date) select 'over-' || i, 'Filler ' || i, 'TODO', $1, i, now() from generate_series(1, 20300) as i", [full.$id]);

    const backup = await (await boss.api.get(`/api/export/workspaces/${full.$id}/backup`)).json();
    expect(backup.tasks).toHaveLength(20_300);
    const csv = await (await boss.api.get(`/api/export/tasks?workspaceId=${full.$id}&format=csv`)).text();
    // Header plus one row per task (names have no line breaks)
    expect(csv.trim().split("\r\n")).toHaveLength(20_301);
});

test("the streamed backup is valid JSON for an empty workspace and for an exact multiple of a chunk", async ({ baseURL }) => {
    const boss = await registerUser(baseURL!, "Chunk Cleo");
    const empty = await createWorkspace(boss.api, "Empty WS");
    expect((await (await boss.api.get(`/api/export/workspaces/${empty.$id}/backup`)).json()).tasks).toEqual([]);

    const even = await createWorkspace(boss.api, "Even WS");
    await sql("insert into tasks (id, name, status, workspace_id, position) select 'even-' || i, 'T ' || i, 'TODO', $1, i from generate_series(1, 2000) as i", [even.$id]);
    const backup = await (await boss.api.get(`/api/export/workspaces/${even.$id}/backup`)).json();
    expect(backup.tasks).toHaveLength(2000);
    expect(new Set(backup.tasks.map((task: { id: string }) => task.id)).size).toBe(2000);
    // The parts after the tasks are still there
    expect(backup.routines).toEqual([]);
    expect(backup.version).toBe(1);
});

test("the admin backup is versioned and leaves out emails unless asked", async () => {
    const res = await admin.api.get(`/api/export/workspaces/${workspaceId}/backup`);
    expect(res.status(), await res.text()).toBe(200);
    const backup = await res.json();
    expect(backup.version).toBe(1);
    expect(backup.workspace.name).toBe("Export WS");
    expect(backup.workspace.inviteCode).toBeUndefined();
    expect(backup.tasks.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(backup.members)).not.toContain(member.email);
    const withEmails = await (await admin.api.get(`/api/export/workspaces/${workspaceId}/backup?emails=true`)).json();
    expect(JSON.stringify(withEmails.members)).toContain(member.email);
});

test("my data has the tasks assigned to me", async () => {
    const res = await member.api.get("/api/export/me");
    expect(res.status(), await res.text()).toBe(200);
    const data = await res.json();
    expect(data.account.email).toBe(member.email);
    expect(data.workspaces.map((w: { name: string }) => w.name)).toContain("Export WS");
    expect(data.assignedTasks.map((t: { name: string }) => t.name)).toEqual(["Plain export task"]);
});

test("calendar subscribe link: private, my tasks only, resettable", async ({ baseURL }) => {
    const link = async (user: TestUser, reset = false) => {
        const res = await user.api.post("/api/export/calendar-feed", { data: { workspaceId, reset } });
        expect(res.status(), await res.text()).toBe(200);
        return new URL((await res.json()).data.url).pathname;
    };
    expect((await outsider.api.post("/api/export/calendar-feed", { data: { workspaceId } })).status()).toBe(401);

    const anon = await request.newContext({ baseURL });
    const first = await link(admin);
    expect(await link(admin)).toBe(first); // stable until reset
    const feed = await anon.get(first);
    expect(feed.status()).toBe(200);
    expect(feed.headers()["content-type"]).toContain("text/calendar");
    const body = await feed.text();
    // The admin's dated tasks; the member's undated one isn't in a calendar anyway
    expect(body).toContain("SUMMARY:All-day export task");
    expect(body).toContain("SUMMARY:Timed export task");

    // A wrong key, or someone else's user id with this key, is a plain 404
    expect((await anon.get(first.replace(/[^/]+\.ics$/, "wrong-key.ics"))).status()).toBe(404);
    const memberLink = await link(member);
    expect((await anon.get(memberLink.replace(/\/feed\/[^/]+\//, `/feed/${first.split("/")[4]}/`))).status()).toBe(404);

    // The key can't be set through preferences, and a reset retires the old link
    await admin.api.patch("/api/account/preferences", { data: { calendarFeedKey: "chosen-by-client" } });
    expect((await anon.get(first)).status()).toBe(200);
    const second = await link(admin, true);
    expect(second).not.toBe(first);
    expect((await anon.get(first)).status()).toBe(404);
    expect((await anon.get(second)).status()).toBe(200);
    await anon.dispose();
});
