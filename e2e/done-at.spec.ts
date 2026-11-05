import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, sql } from "./helpers";

// A task's "finished at" (done_at) is set by the database when it becomes DONE and survives every
// later edit, drag and Undo; it's cleared when the task is reopened
test("done_at: set on DONE, kept through edits, drags and Undo, cleared on reopening", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Done Dee");
    const workspace = await createWorkspace(admin.api, "Done WS");
    const project = await createProject(admin.api, workspace.$id, "Done project");
    const [me] = await getMembers(admin.api, workspace.$id);
    const get = async (id: string) => (await (await admin.api.get(`/api/tasks/${id}`)).json()).data as { doneAt: string | null };

    const id = (await (await createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name: "Finish me" })).json()).data.$id as string;
    expect((await get(id)).doneAt).toBeNull();

    // Becoming DONE sets it (to about now)
    expect((await admin.api.patch(`/api/tasks/${id}`, { data: { status: "DONE" } })).status()).toBe(200);
    const first = (await get(id)).doneAt!;
    expect(Date.now() - new Date(first).getTime()).toBeLessThan(60_000);

    // Pretend it was finished three days ago; an edit, a drag within the column and a status
    // "change" to the same DONE don't move it
    await sql("update tasks set done_at = now() - interval '3 days' where id = $1", [id]);
    const threeDaysAgo = (await get(id)).doneAt!;
    expect(Date.now() - new Date(threeDaysAgo).getTime()).toBeGreaterThan(2.9 * 86_400_000);
    expect((await admin.api.patch(`/api/tasks/${id}`, { data: { name: "Renamed" } })).status()).toBe(200);
    expect((await admin.api.post("/api/tasks/bulk-update", { data: { tasks: [{ $id: id, status: "DONE", position: 5000 }] } })).status()).toBe(200);
    expect((await admin.api.patch(`/api/tasks/${id}`, { data: { status: "DONE" } })).status()).toBe(200);
    expect((await get(id)).doneAt).toBe(threeDaysAgo);

    // Undo of a delete keeps it
    const deleted = await (await admin.api.post("/api/tasks/bulk-edit", { data: { ids: [id], changes: { delete: true } } })).json();
    expect((await admin.api.post("/api/tasks/restore", { data: { tasks: deleted.data.previous } })).status()).toBe(200);
    expect((await get(id)).doneAt).toBe(threeDaysAgo);

    // Reopened: cleared; finished again: new
    expect((await admin.api.patch(`/api/tasks/${id}`, { data: { status: "IN_PROGRESS" } })).status()).toBe(200);
    expect((await get(id)).doneAt).toBeNull();
    expect((await admin.api.patch(`/api/tasks/${id}`, { data: { status: "DONE" } })).status()).toBe(200);
    expect(Date.now() - new Date((await get(id)).doneAt!).getTime()).toBeLessThan(60_000);
});
