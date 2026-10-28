import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

import { TaskStatus } from "../types";
import { restoreTasks, toastWithUndo } from "./undo";

type Changes = { status?: TaskStatus; assigneeIds?: string[]; dueDate?: string | null } | { delete: true };
type Previous = { $id: string; status: TaskStatus; assigneeIds: string[]; dueDate: string | null; [key: string]: unknown };

// The table's bulk actions; every change comes with an Undo
export const useBulkEditTasks = () => {
    const queryClient = useQueryClient();

    const send = async (ids: string[], changes: Changes) => {
        const response = await client.api.tasks["bulk-edit"].$post({ json: { ids, changes } });
        const body = await response.json().catch(() => ({})) as { data?: { previous: Previous[] }; error?: string };
        if (!response.ok || !body.data) {
            throw new ApiError(body.error ?? "Couldn't update the tasks", response.status);
        }
        return body.data.previous;
    };

    // Each task goes back to its own earlier values
    const revert = async (previous: Previous[], changes: Changes) => {
        await Promise.all(previous.map((task) => client.api.tasks[":taskId"].$patch({
            param: { taskId: task.$id },
            json: {
                ...("status" in changes ? { status: task.status } : {}),
                ...("assigneeIds" in changes && task.assigneeIds.length ? { assigneeIds: task.assigneeIds } : {}),
                ...("dueDate" in changes ? { dueDate: task.dueDate } : {}),
            },
        })));
        await queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success("Changes undone");
    };

    return useMutation<Previous[], Error, { ids: string[]; changes: Changes }>({
        mutationFn: ({ ids, changes }) => send(ids, changes),
        onSuccess: (previous, { ids, changes }) => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            const count = `${ids.length} ${ids.length === 1 ? "task" : "tasks"}`;
            if ("delete" in changes) {
                toastWithUndo(`Deleted ${count}`, () => restoreTasks(queryClient, previous));
            } else {
                toastWithUndo(`Updated ${count}`, () => revert(previous, changes));
            }
        },
        onError: (error) => toast.error(error.message),
    });
};
