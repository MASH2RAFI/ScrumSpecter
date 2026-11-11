import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, CRON_SECRET, getMembers, registerUser, sql } from "./helpers";

// A routine's tasks are made up to the sprint's end, and the generator knows a day is covered only by finding a task due
// at that exact time. A routine task someone deletes or moves away used to come back at the next run (the nightly cron, or
// any edit of the routine). Now its day is remembered; undo makes the day count again.
test("a routine task that is deleted or moved is not made again; undo, and only undo, covers the day again", async ({ baseURL }) => {
    test.setTimeout(120_000);
    const admin = await registerUser(baseURL!, "Skip Sky");
    const workspace = await createWorkspace(admin.api, "Skip WS");
    const project = await createProject(admin.api, workspace.$id, "Skip project", 14);
    const [me] = await getMembers(admin.api, workspace.$id);
    const made = await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name: "Daily", projectId: project.$id, assigneeIds: [me.$id], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    const routineId = (await made.json()).data.$id as string;

    type Row = { id: string; due_date: Date; name: string; position: number };
    const upcoming = await sql<Row>("select id, due_date, name, position from tasks where routine_id = $1 and due_date > now() order by due_date limit 8", [routineId]);
    expect(upcoming.length).toBeGreaterThanOrEqual(6);
    const [, deleted, moved, bulkRemoved, undone] = upcoming;

    const runCron = async () => expect((await admin.api.get("/api/cron/routines", { headers: { authorization: `Bearer ${CRON_SECRET}` } })).status()).toBe(200);
    const onDay = async (due: Date) => Number((await sql<{ n: string }>("select count(*) as n from tasks where routine_id = $1 and due_date = $2", [routineId, due]))[0].n);
    const skipRows = async (due: Date) => Number((await sql<{ n: string }>("select count(*) as n from routine_skips where routine_id = $1 and date = ($2::timestamptz at time zone 'UTC')::date", [routineId, due]))[0].n);

    // Deleted: stays gone after the next run
    expect((await admin.api.delete(`/api/tasks/${deleted.id}`)).status()).toBe(200);
    await runCron();
    expect(await onDay(deleted.due_date)).toBe(0);

    // Moved to another day: the day it left is not made again, and the moved task is still there
    const later = new Date(moved.due_date.getTime() + 36 * 3_600_000);
    expect((await admin.api.patch(`/api/tasks/${moved.id}`, { data: { dueDate: later.toISOString() } })).status()).toBe(200);
    await runCron();
    expect(await onDay(moved.due_date)).toBe(0);
    expect(await onDay(later)).toBe(1);

    // Removed by a bulk script
    const run = await admin.api.post(`/api/workspaces/${workspace.$id}/bulk`, { data: { script: `task remove id:${bulkRemoved.id}`, apply: true } });
    expect((await run.json()).data.applied, await run.text()).toBe(true);
    await runCron();
    expect(await onDay(bulkRemoved.due_date)).toBe(0);

    // Deleted, then undone: the day counts again, and a run doesn't double it
    expect((await admin.api.delete(`/api/tasks/${undone.id}`)).status()).toBe(200);
    expect(await skipRows(undone.due_date)).toBe(1);
    const back = await admin.api.post("/api/tasks/restore", { data: { tasks: [{
        $id: undone.id, name: undone.name, status: "TODO", workspaceId: workspace.$id, projectId: project.$id, assigneeIds: [me.$id],
        position: undone.position, dueDate: undone.due_date.toISOString(), routineId,
    }] } });
    expect((await back.json()).data.restored, await back.text()).toBe(1);
    expect(await skipRows(undone.due_date)).toBe(0);
    await runCron();
    expect(await onDay(undone.due_date)).toBe(1);

    // Everything else is as it was: the days nobody touched are still covered, once each
    expect(await onDay(upcoming[0].due_date)).toBe(1);
    expect(await onDay(upcoming[5].due_date)).toBe(1);
    expect(await skipRows(deleted.due_date)).toBe(1);
    expect(await skipRows(moved.due_date)).toBe(1);
    expect(await skipRows(bulkRemoved.due_date)).toBe(1);
});
