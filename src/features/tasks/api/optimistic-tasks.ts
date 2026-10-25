import type { QueryClient, QueryKey } from "@tanstack/react-query";

type CachedTask = { $id: string; [key: string]: unknown };
type TaskList = { documents: CachedTask[]; total: number };
type Snapshot = [QueryKey, unknown][];

// Applies `patch` to every cached copy of the given tasks (lists and single-task views)
// before the server answers. Returns a snapshot to restore if the request fails.
export const patchCachedTasks = async (
    queryClient: QueryClient,
    patches: Map<string, Record<string, unknown>>,
): Promise<Snapshot> => {
    await Promise.all([
        queryClient.cancelQueries({ queryKey: ["tasks"] }),
        queryClient.cancelQueries({ queryKey: ["task"] }),
    ]);

    const snapshot: Snapshot = [
        ...queryClient.getQueriesData({ queryKey: ["tasks"] }),
        ...queryClient.getQueriesData({ queryKey: ["task"] }),
    ];

    const apply = (task: CachedTask) => {
        const patch = patches.get(task.$id);
        return patch ? { ...task, ...patch } : task;
    };

    queryClient.setQueriesData<TaskList>({ queryKey: ["tasks"] }, (list) =>
        list?.documents ? { ...list, documents: list.documents.map(apply) } : list
    );
    queryClient.setQueriesData<CachedTask>({ queryKey: ["task"] }, (task) =>
        task?.$id ? apply(task) : task
    );

    return snapshot;
};

export const restoreCachedTasks = (queryClient: QueryClient, snapshot?: Snapshot) => {
    snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
};

// Only plain fields can be shown before the server responds; project/assignee
// changes need the populated objects, so they wait for the refetch
export const OPTIMISTIC_TASK_FIELDS = ["name", "status", "description", "storyPoints"] as const;
