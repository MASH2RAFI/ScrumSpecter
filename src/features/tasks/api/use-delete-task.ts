import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

import { findCachedTask } from "./optimistic-tasks";
import { restoreTasks, toastWithUndo } from "./undo";

type ResponseType = InferResponseType<typeof client.api.tasks[":taskId"]["$delete"], 200>;
type RequestType = InferRequestType<typeof client.api.tasks[":taskId"]["$delete"]>;

export const useDeleteTask = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation<
        ResponseType,
        Error,
        RequestType,
        { deleted?: Record<string, unknown> }
    >({
        mutationFn: async ({ param }) => {
            const response = await client.api.tasks[":taskId"]["$delete"]({ param });
            if (!response.ok) {
                throw new Error("Task deletion failed");
            }
            return await response.json();
        },
        // Remembered before it's gone, so Undo can put it back
        onMutate: ({ param }) => ({ deleted: findCachedTask(queryClient, param.taskId) }),
        onSuccess: ({ data }, _variables, context) => {
            const deleted = context?.deleted;
            if (deleted) {
                toastWithUndo("Task deleted", () => restoreTasks(queryClient, [deleted]));
            } else {
                toast.success("Task deleted");
            }

            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["task", data.$id] });
        },
        onError: () => {
            toast.error("Failed to delete Task");
        }
    });
    return mutation;
};
