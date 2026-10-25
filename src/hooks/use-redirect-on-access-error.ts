import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isAccessError } from "@/lib/api-error";

/**
 * Sends the user to create a workspace when any query fails with 401/403/404.
 * Network errors and 5xx stay on the page so a blip doesn't kick the user out.
 */
export const useRedirectOnAccessError = (...errors: unknown[]) => {
    const router = useRouter();
    const shouldRedirect = errors.some(isAccessError);

    useEffect(() => {
        if (shouldRedirect) {
            router.push("/workspaces/create");
        }
    }, [shouldRedirect, router]);
};
