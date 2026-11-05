import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser } from "./helpers";

// "Overdue" means one thing everywhere: a time block is over, or a date-only task's working day
// (18:00 in the person's time zone, here Dhaka) is over. Home's total, the project cards and the
// Overdue filter used to disagree for tasks stored at noon UTC (routines, API clients), which the
// SQL ended up to 18 hours late (this test bites in the Dhaka morning, when yesterday's noon-UTC
// task has ended but the old rule had not yet caught up).
test("overdue: Home's total, the project's count and the filter agree", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Over Ollie");
    const workspace = await createWorkspace(admin.api, "Overdue WS");
    const project = await createProject(admin.api, workspace.$id, "Overdue project");
    const [me] = await getMembers(admin.api, workspace.$id);
    const day = (offset: number) => new Date(Date.now() + 6 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
    const add = (name: string, dueDate: string) => createTask(admin.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name, dueDate });

    // Both ended yesterday evening: one stored as noon UTC (routines), one as Dhaka midnight (the task form)
    await add("Ended yesterday, noon UTC", `${day(-1)}T12:00:00.000Z`);
    await add("Ended yesterday, Dhaka midnight", new Date(`${day(-1)}T00:00:00+06:00`).toISOString());
    // Not over for a day yet
    await add("Due tomorrow", new Date(`${day(1)}T00:00:00+06:00`).toISOString());

    const week = `weekFrom=${encodeURIComponent(new Date(Date.now() - 3 * 86_400_000).toISOString())}&weekTo=${encodeURIComponent(new Date(Date.now() + 4 * 86_400_000).toISOString())}`;
    const summary = (await (await admin.api.get(`/api/tasks/summary?workspaceId=${workspace.$id}&${week}`)).json()).data;
    expect(summary.overdue).toBe(2);
    expect(summary.projects[0].overdue).toBe(2);

    const listed = (await (await admin.api.get(`/api/tasks?workspaceId=${workspace.$id}&overdue=true&scope=home&${week}`)).json()).data.documents as { name: string }[];
    expect(listed.map((task) => task.name).sort()).toEqual(["Ended yesterday, Dhaka midnight", "Ended yesterday, noon UTC"]);
    const facets = (await (await admin.api.get(`/api/tasks/facets?workspaceId=${workspace.$id}&scope=home&${week}`)).json()).data;
    expect(facets.overdue).toBe(2);
});
