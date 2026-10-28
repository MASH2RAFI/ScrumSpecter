import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.workspaces[":workspaceId"]["reset-viewer-invite-code"]["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.workspaces[":workspaceId"]["reset-viewer-invite-code"]["$post"]>;

export const useResetViewerInviteCode = () => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ param }) => {
            const response = await client.api.workspaces[":workspaceId"]["reset-viewer-invite-code"]["$post"]({ param });
            if (!response.ok) {
                throw new Error("Viewer link reset failed");
            }
            return await response.json();
        },
        onSuccess: ({ data }) => {
            toast.success("Viewer link reset");
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            queryClient.invalidateQueries({ queryKey: ["workspaces", data.$id] });
        },
        onError: () => {
            toast.error("Failed to reset the viewer link");
        },
    });
};
