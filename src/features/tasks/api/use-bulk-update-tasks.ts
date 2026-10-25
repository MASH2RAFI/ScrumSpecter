import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

import { patchCachedTasks, restoreCachedTasks } from "./optimistic-tasks";

type ResponseType = InferResponseType<typeof client.api.tasks["bulk-update"]["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.tasks["bulk-update"]["$post"]>;

export const useBulkUpdateTasks = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation<
        ResponseType,
        Error,
        RequestType,
        { snapshot: Awaited<ReturnType<typeof patchCachedTasks>> }
    >({
        mutationFn: async ({ json }) => {
            const response = await client.api.tasks["bulk-update"]["$post"]({ json });
            if (!response.ok) {
                throw new Error("Tasks update failed");
            }
            return await response.json();
        },
        // Table and calendar views see the drag immediately, not after the refetch
        onMutate: async ({ json }) => {
            const snapshot = await patchCachedTasks(
                queryClient,
                new Map(json.tasks.map(({ $id, status, position }) => [$id, { status, position }])),
            );
            return { snapshot };
        },
        onSuccess: () => {
            toast.success("Tasks updates successfully");
        },
        onError: (_error, _variables, context) => {
            restoreCachedTasks(queryClient, context?.snapshot);
            toast.error("Failed to update Tasks");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
    });
    return mutation;
};
