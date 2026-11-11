import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, getMembers, registerUser, sql } from "./helpers";

// Taking a weekday off a routine removes its upcoming not-started tasks on that day (they used to stay on the board
// up to the sprint's end); a task that has been started stays. Same through the app and through a bulk script.
const TODAY = "date_trunc('day', now() at time zone 'UTC')";
const DAY = "extract(isodow from due_date at time zone 'UTC')::int";

const count = async (routineId: string, where: string) =>
    Number((await sql<{ n: string }>(`select count(*) as n from tasks where routine_id = $1 and due_date >= ${TODAY} and ${where}`, [routineId]))[0].n);

test("changing a routine's weekdays removes its upcoming not-started tasks on the days dropped", async ({ baseURL }) => {
    const admin = await registerUser(baseURL!, "Days Dee");
    const workspace = await createWorkspace(admin.api, "Days WS");
    const project = await createProject(admin.api, workspace.$id, "Days project", 14);
    const [me] = await getMembers(admin.api, workspace.$id);
    const make = async (name: string) => (await (await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name, projectId: project.$id, assigneeIds: [me.$id], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    })).json()).data.$id as string;

    // Through the app: Monday only
    const viaApp = await make("Via app");
    expect(await count(viaApp, `${DAY} <> 1`)).toBeGreaterThan(0);
    // One of the Tuesday tasks is already being worked on: it stays
    const [started] = await sql<{ id: string }>(`select id from tasks where routine_id = $1 and ${DAY} = 2 and due_date >= ${TODAY} order by due_date limit 1`, [viaApp]);
    expect((await admin.api.patch(`/api/tasks/${started.id}`, { data: { status: "IN_PROGRESS" } })).status()).toBe(200);
    const kept = await count(viaApp, `${DAY} = 1`);
    expect(kept).toBeGreaterThan(0);
    expect((await admin.api.patch(`/api/routines/${viaApp}`, { data: { weekdays: [1] } })).status()).toBe(200);
    expect(await count(viaApp, `status = 'TODO' and ${DAY} <> 1`)).toBe(0);
    expect(await count(viaApp, `status = 'IN_PROGRESS'`)).toBe(1);
    expect(await count(viaApp, `${DAY} = 1`)).toBe(kept);

    // Through a bulk script
    const viaBulk = await make("Via bulk");
    expect(await count(viaBulk, `${DAY} <> 1`)).toBeGreaterThan(0);
    const run = await admin.api.post(`/api/workspaces/${workspace.$id}/bulk`, { data: { script: `routine update "Via bulk" days:mon`, apply: true } });
    expect((await run.json()).data.applied, await run.text()).toBe(true);
    expect(await count(viaBulk, `${DAY} <> 1`)).toBe(0);
    expect(await count(viaBulk, `${DAY} = 1`)).toBeGreaterThan(0);
});
