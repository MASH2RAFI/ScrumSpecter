import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: role picker, viewer link, several assignees, and a change request from an assignee
// to an admin's approval
test.describe.configure({ mode: "serial" });

let page: Page;
let errors: string[];
let admin: TestUser, assignee: TestUser;
let workspace: { $id: string; inviteCode: string };
let taskId: string;
let assigneeMemberId: string;

test.beforeAll(async ({ browser, baseURL }) => {
    admin = await registerUser(baseURL!, "Role Rhea");
    assignee = await registerUser(baseURL!, "Role Aria");
    workspace = await createWorkspace(admin.api, "Roles UI");
    const projectId = (await createProject(admin.api, workspace.$id, "Website", 14)).$id;
    await assignee.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } });
    const members = await getMembers(admin.api, workspace.$id);
    assigneeMemberId = members.find((member) => member.name === assignee.name)!.$id;
    const adminMemberId = members.find((member) => member.name === admin.name)!.$id;
    const res = await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeIds: [assigneeMemberId, adminMemberId], name: "Landing page" });
    taskId = (await res.json()).data.$id;
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    errors = watchConsole(page);
});

test.afterAll(async () => {
    await page.close();
});

test.afterEach(() => {
    const unexpected = errors.filter((error) => !/http (401|403):|status of (401|403)/.test(error));
    expect(unexpected, unexpected.join("\n")).toEqual([]);
    errors.length = 0;
});

test("admins pick one of five roles; the viewer link is in Invites", async ({ baseURL }) => {
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=members`, { timeout: 90_000 });
    const panel = page.getByRole("dialog", { name: "Members" });
    await expect(panel.getByText("Assignee", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: `Options for ${assignee.name}` }).click();
    for (const role of ["Admin", "Supervisor", "Reviewer", "Assignee", "Viewer"]) {
        await expect(page.getByRole("menuitem", { name: new RegExp(`^${role}`) })).toBeVisible();
    }
    await page.getByRole("menuitem", { name: /^Reviewer/ }).click();
    await expect(panel.getByText("Reviewer", { exact: true })).toBeVisible();
    // Back to Assignee for the request below
    await panel.getByRole("button", { name: `Options for ${assignee.name}` }).click();
    await page.getByRole("menuitem", { name: /^Assignee/ }).click();
    await expect(panel.getByText("Assignee", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Invites" }).click();
    await expect(settings.getByLabel("Viewer link", { exact: true })).toHaveValue(new RegExp(`/workspaces/${workspace.$id}/join/\\w{10}$`));
    await page.keyboard.press("Escape");
});

test("several assignees show on the task", async () => {
    await page.goto(`/workspaces/${workspace.$id}/tasks?task=${taskId}`, { timeout: 90_000 });
    await expect(page.getByText("Assignees", { exact: true })).toBeVisible();
    await expect(page.getByText(assignee.name).first()).toBeVisible();
});

test("an assignee's edit becomes a request; an admin approves it", async ({ baseURL }) => {
    await page.context().clearCookies();
    await signInBrowser(page, assignee, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks?edit-task=${taskId}`, { timeout: 90_000 });
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Enter task name").fill("Landing page v2");
    await dialog.getByLabel("Note for the reviewer").fill("New copy from marketing");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Request sent")).toBeVisible();

    await page.goto(`/workspaces/${workspace.$id}/requests`, { timeout: 90_000 });
    const card = page.getByLabel("Change: Landing page");
    await expect(card).toContainText("Landing page v2");
    await expect(card).toContainText("New copy from marketing");
    await expect(card.getByRole("button", { name: "Withdraw" })).toBeVisible();

    await page.context().clearCookies();
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/requests`, { timeout: 90_000 });
    await expect(page.getByLabel("1 waiting for review")).toBeVisible();
    const review = page.getByLabel("Change: Landing page");
    await review.getByLabel(`Reply to ${assignee.name}`).fill("Looks good");
    await review.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved and applied")).toBeVisible();
    await expect(review).toContainText(`Approved by ${admin.name}`);

    const task = (await (await admin.api.get(`/api/tasks/${taskId}`)).json()).data;
    expect(task.name).toBe("Landing page v2");
});
