import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

import { findCachedTask, patchCachedTasks, restoreCachedTasks } from "./optimistic-tasks";
import { toastWithUndo } from "./undo";

type ResponseType = InferResponseType<typeof client.api.tasks["bulk-update"]["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.tasks["bulk-update"]["$post"]>;

export const useBulkUpdateTasks = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation<
        ResponseType,
        Error,
        RequestType,
        { snapshot: Awaited<ReturnType<typeof patchCachedTasks>>; previous: { $id: string; status: string; position: number }[] }
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
            // Where the tasks were, for Undo
            const previous = json.tasks.flatMap(({ $id }) => {
                const task = findCachedTask(queryClient, $id);
                return task ? [{ $id, status: task.status as string, position: task.position as number }] : [];
            });
            const snapshot = await patchCachedTasks(
                queryClient,
                new Map(json.tasks.map(({ $id, status, position }) => [$id, { status, position }])),
            );
            return { snapshot, previous };
        },
        onSuccess: (_data, { json }, context) => {
            const previous = context?.previous ?? [];
            const moved = previous.some((before) => json.tasks.some((after) => after.$id === before.$id && after.status !== before.status));
            if (!moved || previous.length === 0) return;
            toastWithUndo("Task moved", () => mutation.mutateAsync({ json: { tasks: previous as never } }));
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
