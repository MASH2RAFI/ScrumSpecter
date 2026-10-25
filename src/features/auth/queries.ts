import "server-only";

import { cookies } from "next/headers";

import { getUserFromToken } from "@/lib/auth";
import { AUTH_COOKIE } from "./constants";

export const getCurrent = async () => {
    try {
        const session = cookies().get(AUTH_COOKIE);

        if (!session?.value) {
            return null;
        }

        return await getUserFromToken(session.value);
    } catch {
        return null;
    }
};
