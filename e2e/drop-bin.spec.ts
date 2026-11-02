import { expect, test, type Locator, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, html5Drag, registerUser, signInBrowser, type TestUser } from "./helpers";

// Browser: dragging an item to the bin at the bottom of the page deletes (or withdraws) it
test.describe.configure({ mode: "serial" });

let admin: TestUser, assignee: TestUser, viewer: TestUser;
let workspaceId: string, projectId: string, adminMemberId: string;

test.beforeAll(async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Bin Admin");
    assignee = await registerUser(baseURL!, "Bin Assignee");
    viewer = await registerUser(baseURL!, "Bin Viewer");
    const workspace = await createWorkspace(admin.api, "Drop bin");
    workspaceId = workspace.$id;
    projectId = (await createProject(admin.api, workspaceId, "Website", 14)).$id;
    adminMemberId = (await getMembers(admin.api, workspaceId))[0].$id;
    await assignee.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: workspace.inviteCode } });
    const { viewerInviteCode } = (await (await admin.api.get(`/api/workspaces/${workspaceId}`)).json()).data;
    await viewer.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: viewerInviteCode } });
});

// The Kanban's drag library follows the mouse: press, move past its threshold, then over the target
const mouseDrag = async (page: Page, source: Locator, target: Locator) => {
    const from = (await source.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 5 });
    const to = (await target.boundingBox())!;
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await expect(target).toHaveAttribute("aria-hidden", "false");
    await page.waitForTimeout(300);
    await page.mouse.up();
};

test("a Kanban card dropped on the bin is deleted, and Undo brings it back", async ({ page, baseURL }) => {
    await createTask(admin.api, { workspaceId, projectId, assigneeId: adminMemberId, name: "Binned card", status: "TODO" });
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=kanban`, { timeout: 90_000 });

    const card = page.locator("[data-rfd-draggable-id]").filter({ hasText: "Binned card" });
    const bin = page.getByTestId("drop-bin");
    await expect(card).toBeVisible();
    await expect(bin).toHaveAttribute("aria-hidden", "true");

    await mouseDrag(page, card, bin);
    await expect(card).toHaveCount(0);
    await expect(page.getByText("Task deleted")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(card).toBeVisible();
});

test("a viewer gets no bin", async ({ page, baseURL }) => {
    await signInBrowser(page, viewer, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=kanban`, { timeout: 90_000 });
    await expect(page.getByText("Binned card")).toBeVisible();
    await expect(page.getByTestId("drop-bin")).toHaveCount(0);
});

test("a routine dropped on the bin is deleted after the confirm", async ({ page, baseURL }) => {
    const created = await admin.api.post("/api/routines", {
        data: { workspaceId, projectId, name: "Binned routine", assigneeIds: [adminMemberId], weekdays: [1] },
    });
    expect(created.status()).toBe(200);
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/routines`, { timeout: 90_000 });

    const card = page.locator("[draggable=true]").filter({ hasText: "Binned routine" });
    await html5Drag(page, card, page.getByTestId("drop-bin"));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(card).toHaveCount(0);
    const routines = (await (await admin.api.get(`/api/routines?workspaceId=${workspaceId}`)).json()).data.documents;
    expect(routines.some((routine: { name: string }) => routine.name === "Binned routine")).toBe(false);
});

test("your own pending request dropped on the bin is withdrawn; reviewers can't drag them", async ({ page, baseURL }) => {
    const asked = await assignee.api.post("/api/change-requests", {
        data: { kind: "create", workspaceId, changes: { name: "Binned request", projectId, assigneeIds: [adminMemberId] } },
    });
    expect(asked.status()).toBe(200);

    // The reviewer sees it, but not as something to drag, and gets no bin
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/requests`, { timeout: 90_000 });
    const reviewed = page.getByRole("region", { name: /Binned request/ }).or(page.locator("[aria-label*='Binned request']"));
    await expect(reviewed.first()).toBeVisible();
    await expect(page.locator("[draggable=true]")).toHaveCount(0);
    await expect(page.getByTestId("drop-bin")).toHaveCount(0);

    await signInBrowser(page, assignee, baseURL!);
    await page.goto(`/workspaces/${workspaceId}/requests`, { timeout: 90_000 });
    const mine = page.locator("[draggable=true]").filter({ hasText: "Binned request" });
    await html5Drag(page, mine, page.getByTestId("drop-bin"));
    await expect(page.getByText("No open requests")).toBeVisible();
});
