import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LAST_WORKSPACE_COOKIE } from "@/features/auth/constants";
import { resolvePreferences } from "@/features/auth/preferences";
import { getCurrent } from "@/features/auth/queries";
import { homePath } from "./home-path";

// Sends a signed-in user straight to the workspace they opened last on this device (else their
// newest one, or to create one) in a single redirect: its home, or My Tasks if the person chose
// that landing page. Pages call this instead of redirect("/"),
// which would chain a second redirect.
export const redirectHome = async (userId: string): Promise<never> => {
    const lastId = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
    // Cached session lookup; the callers have just made it
    const { landingPage } = resolvePreferences((await getCurrent())?.preferences);

    redirect((await homePath(userId, lastId, landingPage)).path);
};
