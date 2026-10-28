import { useMutation } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { stopPersistingCache } from "@/lib/query-cache";
import { resumeVersionChecks, stopVersionChecks } from "@/features/workspaces/hooks/use-data-versions";

type ResponseType = InferResponseType<typeof client.api.auth.logout["$post"]>;
type RequestType = InferRequestType<typeof client.api.auth.logout["$post"]>;

export const useLogout = () => {
    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async () => {
            stopVersionChecks();
            const response = await client.api.auth.logout["$post"]();
            if (!response.ok) {
                throw new Error("Logout failed");
            }
            return await response.json();
        },
        onSuccess: () => {
            // A full page load drops the previous user's cached data. Clearing the query cache
            // in place made still-mounted components refetch it and hit 401s.
            stopPersistingCache();
            window.location.replace("/about");
        },
        onError: () => {
            resumeVersionChecks();
            toast.error("Logout failed");
        },
    });
};
