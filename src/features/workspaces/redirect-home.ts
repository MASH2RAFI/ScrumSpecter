import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LAST_WORKSPACE_COOKIE } from "@/features/auth/constants";
import { listUserWorkspaces } from "./queries";

// Sends a signed-in user straight to the workspace they opened last on this device (else their
// newest one, or to create one) in a single redirect. Pages call this instead of redirect("/"),
// which would chain a second redirect.
export const redirectHome = async (userId: string): Promise<never> => {
    const workspaces = await listUserWorkspaces(userId);

    if (workspaces.total === 0) redirect("/workspaces/create");

    // A stale cookie (left or deleted workspace, another account on this browser) falls back
    const lastId = cookies().get(LAST_WORKSPACE_COOKIE)?.value;
    const last = workspaces.documents.find((workspace) => workspace.$id === lastId);

    redirect(`/workspaces/${(last ?? workspaces.documents[0]).$id}`);
};
