import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";
import { TaskStatus } from "../types";

interface UseGetTasksProps {
    workspaceId: string;
    projectId?: string | null;
    status?: TaskStatus | null;
    search?: string | null;
    assigneeId?: string | null;
    dueDate?: string | null;
};

export const useGetTasks = ({
    workspaceId,
    projectId,
    status,
    search,
    assigneeId,
    dueDate,
}: UseGetTasksProps) => {
    const query = useQuery({
        queryKey: [
            "tasks",
            workspaceId,
            projectId,
            status,
            search,
            assigneeId,
            dueDate,
        ],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId),
        // Keep showing the current list while a new filter/search loads, but never
        // another workspace's tasks
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[1] === workspaceId ? keepPreviousData(previous) : undefined,
        queryFn: async () => {
            const response = await client.api.tasks.$get({
                query: {
                    workspaceId,
                    projectId: projectId ?? undefined,
                    status: status ?? undefined,
                    assigneeId: assigneeId ?? undefined,
                    search: search ?? undefined,
                    dueDate: dueDate ?? undefined,
                },
            });

            if (!response.ok) {
                throw new ApiError("Failed to fetch tasks", response.status);
            }

            const { data } = await response.json();
            return data;
        },
    });
    return query;
};
