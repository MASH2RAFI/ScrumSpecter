import "server-only";

import type { UserPreferences } from "@/features/auth/preferences";

import { listUserWorkspaces } from "./queries";

// Where a signed-in person lands: the workspace they opened last on this device (else their newest,
// or the page to create one), on its home or on My Tasks, as they chose. Shared by the redirect from
// "/" and by sign-in, which hands the answer to the browser so it can go there directly.
export const homePath = async (userId: string, lastWorkspaceId: string | undefined, landingPage: UserPreferences["landingPage"]) => {
    const workspaces = await listUserWorkspaces(userId);
    if (workspaces.total === 0) return { path: "/workspaces/create", workspaceId: null };

    // A stale cookie (left or deleted workspace, another account on this browser) falls back
    const workspaceId = (workspaces.documents.find((workspace) => workspace.$id === lastWorkspaceId) ?? workspaces.documents[0]).$id;
    return { path: `/workspaces/${workspaceId}${landingPage === "my-tasks" ? "/tasks" : ""}`, workspaceId };
};
