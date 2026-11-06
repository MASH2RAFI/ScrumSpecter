import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { clearPrimed, primeRequests } from "@/lib/batch-fetch";
import { clearPersistedCache } from "@/lib/query-cache";
import { homeRequestUrls, type HomePreferences } from "@/features/workspaces/home-requests";

// (a failed sign-in throws below, so a successful one is all that reaches onSuccess)
type ResponseType = Extract<InferResponseType<typeof client.api.auth.login["$post"]>, { home: unknown }>;
type RequestType = InferRequestType<typeof client.api.auth.login["$post"]>;

export const useLogin = (next?: string | null) => {
    const router = useRouter();
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ json }) => {
            const response = await client.api.auth.login["$post"]({ json });
            if (!response.ok) {
                const body = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(body.error === "Invalid credentials" ? "Wrong email or password" : body.error ?? "Login failed");
            }
            return await response.json() as ResponseType;
        },
        onSuccess: (data) => {
            // Start clean: nothing cached from whoever used this browser before
            clearPersistedCache();
            queryClient.clear();
            clearPrimed();
            toast.success("Login successful");
            if (next) {
                router.replace(next);
            } else if (data.home) {
                // The server says where this person lands: go there directly (no round trip through
                // the sign-in page and "/"), and ask for the home page's data at once, so it is on
                // its way while the page itself loads
                if (data.workspaceId && data.preferences && data.home === `/workspaces/${data.workspaceId}`) {
                    primeRequests(homeRequestUrls(data.workspaceId, data.preferences as HomePreferences));
                }
                router.replace(data.home);
            } else {
                // The sign-in page sends a signed-in visitor home
                router.refresh();
            }
            queryClient.invalidateQueries({ queryKey: ["current"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
};
