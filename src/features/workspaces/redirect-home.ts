import "server-only";

import { redirect } from "next/navigation";

import { listUserWorkspaces } from "./queries";

// Sends a signed-in user straight to their latest workspace (or to create one) in a single
// redirect. Pages call this instead of redirect("/"), which would chain a second redirect.
export const redirectHome = async (userId: string): Promise<never> => {
    const workspaces = await listUserWorkspaces(userId);

    if (workspaces.total === 0) redirect("/workspaces/create");

    redirect(`/workspaces/${workspaces.documents[0].$id}`);
};
