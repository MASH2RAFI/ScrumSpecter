import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

type InviteLimits = { expiresInDays?: 1 | 7 | 30 | null; maxUses?: 1 | 5 | 10 | 25 | null };

export const useUpdateInviteLimits = () => {
    const queryClient = useQueryClient();
    return useMutation<unknown, Error, { workspaceId: string } & InviteLimits>({
        mutationFn: async ({ workspaceId, ...json }) => {
            const response = await client.api.workspaces[":workspaceId"].invite.$patch({ param: { workspaceId }, json });
            if (!response.ok) {
                throw new ApiError("Couldn't update the invite link", response.status);
            }
            return response.json();
        },
        onSuccess: (_, { workspaceId }) => {
            toast.success("Invite link updated");
            queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
        },
        onError: (error) => toast.error(error.message),
    });
};
