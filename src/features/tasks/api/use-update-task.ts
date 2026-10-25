import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

import { OPTIMISTIC_TASK_FIELDS, patchCachedTasks, restoreCachedTasks } from "./optimistic-tasks";

type ResponseType = InferResponseType<typeof client.api.tasks[":taskId"]["$patch"], 200>;
type RequestType = InferRequestType<typeof client.api.tasks[":taskId"]["$patch"]>;

export const useUpdateTask = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation<
        ResponseType,
        Error,
        RequestType,
        { snapshot: Awaited<ReturnType<typeof patchCachedTasks>> }
    >({
        mutationFn: async ({ json, param }) => {
            const response = await client.api.tasks[":taskId"]["$patch"]({ json, param });
            if (!response.ok) {
                throw new Error("Task update failed");
            }
            return await response.json();
        },
        // Show the edit right away; the refetch in onSettled reconciles with the server
        onMutate: async ({ json, param }) => {
            const patch: Record<string, unknown> = Object.fromEntries(
                OPTIMISTIC_TASK_FIELDS
                    .filter((field) => json[field] !== undefined)
                    .map((field) => [field, json[field]])
            );
            if (json.dueDate !== undefined) {
                patch.dueDate = new Date(json.dueDate as string | number | Date).toISOString();
            }
            const snapshot = await patchCachedTasks(queryClient, new Map([[param.taskId, patch]]));
            return { snapshot };
        },
        onSuccess: () => {
            toast.success("Task updates successfully");
        },
        onError: (_error, _variables, context) => {
            restoreCachedTasks(queryClient, context?.snapshot);
            toast.error("Failed to update Task");
        },
        onSettled: (_data, _error, { param }) => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["task", param.taskId] });
        }
    });
    return mutation;
};
