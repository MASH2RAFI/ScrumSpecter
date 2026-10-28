import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

const errorOf = async (response: Response, fallback: string) =>
    ((await response.json().catch(() => ({}))) as { error?: string }).error ?? fallback;

export const useCreatePlaceholder = () => {
    const queryClient = useQueryClient();
    return useMutation<unknown, Error, { workspaceId: string; name: string; email?: string }>({
        mutationFn: async (json) => {
            const response = await client.api.members.placeholders.$post({ json });
            if (!response.ok) throw new ApiError(await errorOf(response, "Couldn't add the placeholder"), response.status);
            return response.json();
        },
        onSuccess: () => {
            toast.success("Placeholder added");
            queryClient.invalidateQueries({ queryKey: ["members"] });
        },
        onError: (error) => toast.error(error.message),
    });
};

// Hands the placeholder's tasks and routines to someone who has joined
export const useReplacePlaceholder = () => {
    const queryClient = useQueryClient();
    return useMutation<unknown, Error, { placeholderId: string; memberId: string }>({
        mutationFn: async ({ placeholderId, memberId }) => {
            const response = await client.api.members[":memberId"].replace.$post({ param: { memberId: placeholderId }, json: { memberId } });
            if (!response.ok) throw new ApiError(await errorOf(response, "Couldn't hand over the tasks"), response.status);
            return response.json();
        },
        onSuccess: () => {
            toast.success("Tasks handed over");
            queryClient.invalidateQueries({ queryKey: ["members"] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["routines"] });
        },
        onError: (error) => toast.error(error.message),
    });
};
