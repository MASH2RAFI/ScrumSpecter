import { expect, test } from "@playwright/test";

import { createTask, createWorkspace, getMembers, registerUser, signInBrowser, sql, watchConsole } from "./helpers";

// The burndown: days up to today show the points still open then; days to come stay empty;
// the Progress colour compares with how far into the sprint it is
test("burndown: actual points per day up to today, and a progress colour that follows the sprint", async ({ page, baseURL }) => {
    const errors = watchConsole(page);
    const admin = await registerUser(baseURL!, "Burn Bo");
    const workspace = await createWorkspace(admin.api, "Burn WS");
    const [me] = await getMembers(admin.api, workspace.$id);

    // A 14-day sprint that began 4 days ago: today is day 5 (your own calendar day, like the app's)
    const day = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const created = await admin.api.post("/api/projects", {
        multipart: { name: "Burn project", workspaceId: workspace.$id, currentSprintStartDate: day(-4), currentSprintEndDate: day(9) },
    });
    expect(created.status(), await created.text()).toBe(200);
    const projectId = (await created.json()).data.$id as string;

    // 20 points in two tasks; one of them (10) finishes today
    const finished = (await (await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: me.$id, name: "Finished", storyPoints: 10 })).json()).data.$id;
    await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: me.$id, name: "Open", storyPoints: 10 });
    expect((await admin.api.patch(`/api/tasks/${finished}`, { data: { status: "DONE" } })).status()).toBe(200);

    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/analytics`, { timeout: 90_000 });
    await page.getByRole("tab", { name: /Burndown/ }).click();
    await page.getByRole("combobox").filter({ hasText: "Select a project" }).click();
    await page.getByRole("option", { name: "Burn project" }).click();
    // The sprint's own length, from its dates
    await expect(page.getByLabel("Sprint Duration (days)")).toHaveValue("14");
    await page.getByRole("button", { name: "Generate Burndown Chart" }).click();

    // Days 1-4: all 20 still open; day 5 (today): 10; the days to come: no value
    const rows = page.locator("table.sr-only tbody tr");
    await expect(rows).toHaveCount(14);
    const cells = (await rows.evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent))));
    expect(cells.slice(0, 5).map(([, left]) => left)).toEqual(["20", "20", "20", "20", "10"]);
    expect(cells.slice(5).every(([, left]) => left === "–")).toBe(true);

    // 50% done on day 5 of 14 (36% expected): ahead, so green (against the whole sprint it was red)
    await expect(page.getByText("50%", { exact: true })).toHaveClass(/text-green-600/);

    // The CSV leaves the days to come empty
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    const csv = (await (await (await download).createReadStream()).toArray()).join("");
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Day,Ideal remaining (pts),Actual remaining (pts)");
    expect(lines[5]).toMatch(/^5,.*,10$/);
    expect(lines[6]).toMatch(/^6,[^,]*,$/);
    expect(errors, errors.join("\n")).toEqual([]);
});

// A task finished on day 2 stays finished on day 2 when it is renamed or dragged later (the chart
// used to date it by its last update, which every edit and Kanban drop moves)
test("burndown: a finished task keeps its day when it is edited or dragged", async ({ page, baseURL }) => {
    const admin = await registerUser(baseURL!, "Burn Kept");
    const workspace = await createWorkspace(admin.api, "Burn Kept WS");
    const [me] = await getMembers(admin.api, workspace.$id);
    const day = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const created = await admin.api.post("/api/projects", {
        multipart: { name: "Kept project", workspaceId: workspace.$id, currentSprintStartDate: day(-4), currentSprintEndDate: day(9) },
    });
    const projectId = (await created.json()).data.$id as string;
    const finished = (await (await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: me.$id, name: "Finished early", storyPoints: 10 })).json()).data.$id as string;
    await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: me.$id, name: "Open", storyPoints: 10 });
    expect((await admin.api.patch(`/api/tasks/${finished}`, { data: { status: "DONE" } })).status()).toBe(200);
    // Finished three days ago = day 2 of the sprint; then edited and dragged today
    await sql("update tasks set done_at = now() - interval '3 days' where id = $1", [finished]);
    expect((await admin.api.patch(`/api/tasks/${finished}`, { data: { name: "Finished early (renamed)" } })).status()).toBe(200);
    expect((await admin.api.post("/api/tasks/bulk-update", { data: { tasks: [{ $id: finished, status: "DONE", position: 7000 }] } })).status()).toBe(200);

    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/analytics`, { timeout: 90_000 });
    await page.getByRole("tab", { name: /Burndown/ }).click();
    await page.getByRole("combobox").filter({ hasText: "Select a project" }).click();
    await page.getByRole("option", { name: "Kept project" }).click();
    await page.getByRole("button", { name: "Generate Burndown Chart" }).click();
    const rows = page.locator("table.sr-only tbody tr");
    await expect(rows).toHaveCount(14);
    const left = (await rows.evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll("td")[1].textContent))).slice(0, 5);
    expect(left).toEqual(["20", "10", "10", "10", "10"]);
});
