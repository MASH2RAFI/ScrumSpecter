import { expect, test } from "@playwright/test";

import { createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// The getting-started page (/workspaces/create): create, join with an invite link, or set a
// workspace up from bulk commands
test.describe.configure({ mode: "serial" });

const SCRIPT = [
    `project add "Launch" start:2026-11-01 end:2026-11-14`,
    `placeholder add "Designer (TBD)"`,
    `task add "Landing page" project:"Launch" assignee:"Designer (TBD), me" points:3`,
    `routine add "Standup" project:"Launch" days:mon,wed show:calendar`,
].join("\n");

const workspaceNames = async (api: Awaited<ReturnType<typeof registerUser>>["api"]) =>
    ((await (await api.get("/api/workspaces")).json()).data.documents as { name: string }[]).map((w) => w.name);

test("API: a check creates nothing; applying creates the workspace and runs the commands", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Setup Sam");

    const checked = await (await user.api.post("/api/workspaces/setup", { data: { name: "Launch team", script: SCRIPT } })).json();
    expect(checked.data.applied).toBe(false);
    expect(checked.data.results.every((r: { ok: boolean }) => r.ok), JSON.stringify(checked.data.results)).toBe(true);
    expect(await workspaceNames(user.api)).toEqual([]);

    // One bad line: nothing is created
    const bad = await (await user.api.post("/api/workspaces/setup", { data: { name: "Launch team", script: `${SCRIPT}\ntask add "X" project:"Nope"`, apply: true } })).json();
    expect(bad.data.applied).toBe(false);
    expect(bad.data.results.at(-1).error).toMatch(/No project called "Nope"/);
    expect(await workspaceNames(user.api)).toEqual([]);

    const applied = await (await user.api.post("/api/workspaces/setup", { data: { name: "Launch team", script: SCRIPT, apply: true } })).json();
    expect(applied.data).toMatchObject({ applied: true, counts: { project: 1, placeholder: 1, task: 1, routine: 1 } });
    const workspaceId = applied.data.workspaceId;
    expect(await workspaceNames(user.api)).toEqual(["Launch team"]);

    const members = await getMembers(user.api, workspaceId);
    const me = members.find((m) => m.name === "Setup Sam")!;
    expect(me.role).toBe("ADMIN");
    const tasks = (await (await user.api.get(`/api/tasks?workspaceId=${workspaceId}&search=Landing`)).json()).data.documents;
    expect(tasks[0].assigneeIds).toContain(me.$id);
    expect(tasks[0].assigneeIds).toHaveLength(2);
    const routines = (await (await user.api.get(`/api/routines?workspaceId=${workspaceId}`)).json()).data.documents;
    expect(routines[0]).toMatchObject({ name: "Standup", showInCalendar: true, showInTable: false });

    // An empty script is never applied
    const empty = await (await user.api.post("/api/workspaces/setup", { data: { name: "Empty", script: "# nothing", apply: true } })).json();
    expect(empty.data.applied).toBe(false);
});

test("the page offers create, join and bulk input; join takes a pasted invite link", async ({ browser, baseURL }) => {
    const owner = await registerUser(baseURL!, "Owner Olu");
    const workspace = await createWorkspace(owner.api, "Olu's team");
    const newcomer = await registerUser(baseURL!, "Newcomer Nia");

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, newcomer, baseURL!);
    await page.goto("/workspaces/create", { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
    for (const tab of ["Create", "Join", "Bulk input"]) {
        await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
    }
    // Create is the default, and it's just the form (no second set of tabs inside)
    await expect(page.getByPlaceholder("Enter workspace name")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(3);

    await page.getByRole("tab", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(/start=join/);
    await page.getByLabel("Invite link").fill("not a link");
    await page.getByRole("button", { name: "Join workspace" }).click();
    await expect(page.getByText("That doesn't look like an invite link")).toBeVisible();
    // A broken %-escape in the code gets the same message, not an unhandled error
    await page.getByLabel("Invite link").fill(`${baseURL}/workspaces/${workspace.$id}/join/50%`);
    await page.getByRole("button", { name: "Join workspace" }).click();
    await expect(page.getByText("That doesn't look like an invite link").first()).toBeVisible();
    await page.getByLabel("Invite link").fill(`${baseURL}/workspaces/${workspace.$id}/join/${workspace.inviteCode}`);
    await page.getByRole("button", { name: "Join workspace" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace.$id}$`), { timeout: 60_000 });
    expect(errors.filter((e) => !/http 40[13]/.test(e)), errors.join("\n")).toEqual([]);
    await page.close();
});

test("bulk input sets up a new workspace in one go", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Bulk Bo");
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto("/workspaces/create?start=bulk", { timeout: 90_000 });

    const apply = page.getByRole("button", { name: /^Create workspace with/ });
    await page.getByLabel("Commands").fill(SCRIPT);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByLabel("Check results")).toContainText('New project "Launch"');
    // Needs a name first
    await expect(apply).toBeDisabled();
    await page.getByLabel("Workspace name").fill("Bo's launch");
    await expect(apply).toHaveText(/Create workspace with 4 changes/);
    await apply.click();

    await expect(page).toHaveURL(/\/workspaces\/[^/]+$/, { timeout: 60_000 });
    await expect(page.getByText("Workspace created with")).toBeVisible();
    await expect(page.getByRole("main").getByText("Launch").first()).toBeVisible();
    expect(await workspaceNames(user.api)).toEqual(["Bo's launch"]);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});
