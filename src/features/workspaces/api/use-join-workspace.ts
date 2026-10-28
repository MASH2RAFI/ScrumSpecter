import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.workspaces[":workspaceId"]["join"]["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.workspaces[":workspaceId"]["join"]["$post"]>;

export const useJoinWorkspace = () => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ param, json }) => {
            const response = await client.api.workspaces[":workspaceId"]["join"]["$post"]({ param, json });
            if (!response.ok) {
                // e.g. "This invite link has expired", "Already a member"
                const body = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(body.error ?? "Failed to join workspace");
            }
            return await response.json();
        },
        onSuccess: ({ data }) => {
            toast.success("Joined Workspace Successfully");
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            queryClient.invalidateQueries({ queryKey: ["workspaces", data.$id] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
};
