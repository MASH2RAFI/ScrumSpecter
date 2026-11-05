import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// My own edit moves the workspace's data version, and so does a teammate's change that lands right
// after it. The page used to take the new version as "mine" (absorbed it without refetching), so
// the teammate's task never showed, not even after a reload (the saved copy and its version agreed).
test("a teammate's change right after my own edit still shows up", async ({ page, baseURL }) => {
    const errors = watchConsole(page);
    const me = await registerUser(baseURL!, "Stale Sam");
    const workspace = await createWorkspace(me.api, "Stale WS");
    const project = await createProject(me.api, workspace.$id, "Stale project");
    const [member] = await getMembers(me.api, workspace.$id);
    const dueDate = new Date(`${new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10)}T06:00:00.000Z`).toISOString();
    const add = (name: string) => createTask(me.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: member.$id, name, dueDate });

    await add("Mine");
    await signInBrowser(page, me, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    // Move it to In Progress through the menu. Retried and checked by the result: in WebKit a click
    // during the menu's opening animation can land on another item (it picked Backlog once), so
    // the button is found by the end of its name, not by the status it starts with
    const status = page.getByRole("button", { name: /: change status of Mine$/ });
    await expect(async () => {
        await page.keyboard.press("Escape");
        await status.click();
        await page.getByRole("menuitem", { name: "In Progress" }).click({ timeout: 4_000 });
        await expect(status).toHaveAccessibleName(/^In Progress:/, { timeout: 4_000 });
    }).toPass({ timeout: 40_000 });
    // The teammate's task arrives straight after, inside the window the old code swallowed
    await add("From a teammate");

    // It appears without a reload (the check after my edit finds the new version)...
    const teammate = page.getByRole("button", { name: /^From a teammate/ });
    await expect(teammate).toBeVisible({ timeout: 15_000 });
    // ...and is still there after a reload
    await page.waitForTimeout(1_500);
    await page.reload();
    await expect(teammate).toBeVisible({ timeout: 15_000 });
    expect(errors, errors.join("\n")).toEqual([]);
});
