import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

const UNDO_MS = 6_000;

// A success toast with an Undo button
export const toastWithUndo = (message: string, undo: () => Promise<unknown> | void) => {
    toast.success(message, {
        duration: UNDO_MS,
        action: {
            label: "Undo",
            onClick: () => {
                void Promise.resolve(undo()).catch(() => toast.error("Couldn't undo"));
            },
        },
    });
};

// Puts deleted tasks back as they were (POST /api/tasks/restore)
export const restoreTasks = async (queryClient: QueryClient, tasks: Record<string, unknown>[]) => {
    const response = await client.api.tasks.restore.$post({ json: { tasks: tasks as never } });
    if (!response.ok) throw new Error("Restore failed");
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast.success(tasks.length === 1 ? "Task restored" : `${tasks.length} tasks restored`);
};
