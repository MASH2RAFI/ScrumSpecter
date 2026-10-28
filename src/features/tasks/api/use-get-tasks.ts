import { useMemo } from "react";
import { useAppQuery } from "@/lib/use-app-query";
import { keepPreviousData } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";
import { weekRange } from "@/lib/week";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { TaskStatus } from "../types";

// Mirrors the server's list query (features/tasks/server/task-list.ts); everything but
// workspaceId is optional
export interface UseGetTasksProps {
    workspaceId: string;
    projectId?: string | null;
    status?: TaskStatus | null;
    search?: string | null;
    assigneeId?: string | null;
    dueDate?: string | null;
    // The view asking: the server applies the routine rules for it (needs weekFrom/weekTo,
    // except "calendar")
    scope?: "table" | "kanban" | "calendar" | "home";
    weekFrom?: string;
    weekTo?: string;
    from?: string;
    to?: string;
    unscheduled?: boolean;
    openOnly?: boolean;
    ids?: string[];
    excludeProjects?: string[];
    limit?: number;
    offset?: number;
    sortBy?: "name" | "project" | "assignee" | "dueDate" | "storyPoints" | "status" | "createdAt";
    sortDir?: "asc" | "desc";
    doneLimit?: number;
    enabled?: boolean;
};

// The viewer's current week, [weekFrom, weekTo), as the list scopes need it
export const useCurrentWeek = () => {
    const { weekStart } = usePreferences();
    // Recomputed when the day changes, not on every render
    const day = new Date().toDateString();
    return useMemo(() => {
        const { start, end } = weekRange(new Date(), weekStart);
        return { weekFrom: start.toISOString(), weekTo: end.toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekStart, day]);
};

export const useGetTasks = ({ workspaceId, enabled = true, ids, excludeProjects, ...params }: UseGetTasksProps) => {
    const idList = ids?.length ? [...ids].sort().join(",") : undefined;
    const hiddenList = excludeProjects?.length ? [...excludeProjects].sort().join(",") : undefined;
    const query = useAppQuery({
        // Every parameter is part of the key; "tasks" first, so task changes refresh them all
        queryKey: ["tasks", workspaceId, { ...params, ids: idList, excludeProjects: hiddenList }],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId) && enabled && (ids === undefined || Boolean(idList)),
        // Keep showing the current list while a new filter, page or range loads, but never
        // another workspace's tasks
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[1] === workspaceId ? keepPreviousData(previous) : undefined,
        queryFn: async () => {
            const response = await client.api.tasks.$get({
                query: {
                    workspaceId,
                    projectId: params.projectId ?? undefined,
                    status: params.status ?? undefined,
                    assigneeId: params.assigneeId ?? undefined,
                    search: params.search ?? undefined,
                    dueDate: params.dueDate ?? undefined,
                    scope: params.scope,
                    weekFrom: params.weekFrom,
                    weekTo: params.weekTo,
                    from: params.from,
                    to: params.to,
                    unscheduled: params.unscheduled === undefined ? undefined : String(params.unscheduled) as "true" | "false",
                    openOnly: params.openOnly === undefined ? undefined : String(params.openOnly) as "true" | "false",
                    ids: idList,
                    excludeProjects: hiddenList,
                    limit: params.limit?.toString(),
                    offset: params.offset?.toString(),
                    sortBy: params.sortBy,
                    sortDir: params.sortDir,
                    doneLimit: params.doneLimit?.toString(),
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

// Home's counts for this week (server-side, so they stay quick however many tasks there are)
export const useGetTaskSummary = ({ workspaceId }: { workspaceId: string }) => {
    const { weekFrom, weekTo } = useCurrentWeek();
    return useAppQuery({
        // Under "tasks", so any task change refreshes it too
        queryKey: ["tasks", workspaceId, "summary", weekFrom],
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api.tasks.summary.$get({ query: { workspaceId, weekFrom, weekTo } });
            if (!response.ok) {
                throw new ApiError("Failed to fetch the task summary", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};
