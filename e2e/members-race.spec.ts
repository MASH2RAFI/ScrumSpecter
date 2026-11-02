import { expect, test } from "@playwright/test";

import { createWorkspace, getMembers, registerUser } from "./helpers";

// The last-admin check and the write share one transaction with the admin rows locked, so two
// admins acting on each other at the same moment can't leave a workspace without one
test("two admins demoting each other at once leave exactly one admin", async ({ baseURL }) => {
    const ann = await registerUser(baseURL!, "Ann Admin");
    const ben = await registerUser(baseURL!, "Ben Admin");

    for (let round = 0; round < 3; round++) {
        const workspace = await createWorkspace(ann.api, `Race ${round}`);
        expect((await ben.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
        const members = await getMembers(ann.api, workspace.$id);
        const annMember = members.find((member) => member.name === "Ann Admin")!;
        const benMember = members.find((member) => member.name === "Ben Admin")!;
        expect((await ann.api.patch(`/api/members/${benMember.$id}`, { data: { role: "ADMIN" } })).status()).toBe(200);

        const responses = await Promise.all([
            ann.api.patch(`/api/members/${benMember.$id}`, { data: { role: "ASSIGNEE" } }),
            ben.api.patch(`/api/members/${annMember.$id}`, { data: { role: "ASSIGNEE" } }),
        ]);
        // One wins; the other is refused (the last admin, or no longer an admin itself)
        expect(responses.filter((res) => res.status() === 200)).toHaveLength(1);

        const after = await getMembers(ann.api, workspace.$id);
        expect(after.filter((member) => member.role === "ADMIN")).toHaveLength(1);
    }
});

test("two admins leaving at once leave exactly one admin", async ({ baseURL }) => {
    const ann = await registerUser(baseURL!, "Ann Remover");
    const ben = await registerUser(baseURL!, "Ben Remover");
    const workspace = await createWorkspace(ann.api, "Remove race");
    expect((await ben.api.post(`/api/workspaces/${workspace.$id}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    const members = await getMembers(ann.api, workspace.$id);
    const annMember = members.find((member) => member.name === "Ann Remover")!;
    const benMember = members.find((member) => member.name === "Ben Remover")!;
    expect((await ann.api.patch(`/api/members/${benMember.$id}`, { data: { role: "ADMIN" } })).status()).toBe(200);

    await Promise.all([
        ann.api.post("/api/members/leave-workspace", { data: { workspaceId: workspace.$id } }),
        ben.api.post("/api/members/leave-workspace", { data: { workspaceId: workspace.$id } }),
    ]);

    const remaining = (await ann.api.get(`/api/members?workspaceId=${workspace.$id}`)).ok()
        ? await getMembers(ann.api, workspace.$id)
        : await getMembers(ben.api, workspace.$id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].role).toBe("ADMIN");
    expect([annMember.$id, benMember.$id]).toContain(remaining[0].$id);
});
