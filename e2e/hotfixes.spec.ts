import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, getMembers, registerUser } from "./helpers";

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

// Postgres caps one statement at 65,535 parameters (~5,000 task rows); generation must batch
test("extending a sprint creates more than 6,000 routine tasks in one go", async ({ baseURL }) => {
    test.setTimeout(180_000);
    const user = await registerUser(baseURL!, "Bulk Routine Admin");
    const workspaceId = (await createWorkspace(user.api, "Big Routine WS")).$id;
    const projectId = (await createProject(user.api, workspaceId, "Long Sprint", 1)).$id;
    const memberId = (await getMembers(user.api, workspaceId))[0].$id;

    const routineCount = 18;
    for (let i = 0; i < routineCount; i++) {
        const res = await user.api.post("/api/routines", {
            data: { workspaceId, name: `Daily ${i}`, projectId, assigneeIds: [memberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
        });
        expect(res.status(), await res.text()).toBe(200);
    }

    // One generateRoutineTasks call for all 18 routines: 18 x ~365 days > 6,000 rows
    const res = await user.api.patch(`/api/projects/${projectId}`, { multipart: { workspaceId, currentSprintEndDate: isoDay(364) } });
    expect(res.status(), await res.text()).toBe(200);

    // Public holidays are skipped, so count everything rather than days x routines
    const list = await user.api.get(`/api/tasks?workspaceId=${workspaceId}&projectId=${projectId}`);
    expect(list.status()).toBe(200);
    expect((await list.json()).data.documents.length).toBeGreaterThan(6000);
});
