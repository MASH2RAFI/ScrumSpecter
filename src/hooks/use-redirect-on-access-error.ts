import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { isAccessError } from "@/lib/api-error";

/**
 * Leaves a page whose workspace, project or task fails with 401/403/404 (an old link, a
 * deleted workspace, one you were removed from). "/" goes on to the latest workspace the user
 * is in, and only to workspace creation when there's none (redirect-home.ts).
 * Network errors and 5xx stay on the page so a blip doesn't kick the user out.
 */
export const useRedirectOnAccessError = (...errors: unknown[]) => {
    const router = useRouter();
    const shouldRedirect = errors.some(isAccessError);

    useEffect(() => {
        if (shouldRedirect) {
            toast.error("That page isn't available to you. It may have been deleted, or you're no longer a member.", { id: "access-error" });
            router.replace("/");
        }
    }, [shouldRedirect, router]);
};
