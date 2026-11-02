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
    // The view asking: the server applies the routine rules for it (needs weekFrom/weekTo,
    // except "calendar")
    scope?: "table" | "kanban" | "calendar" | "home";
    weekFrom?: string;
    weekTo?: string;
    from?: string;
    to?: string;
    unscheduled?: boolean;
    openOnly?: boolean;
    // Only tasks the person starred (or from routines they starred)
    starred?: boolean;
    // The saved My Tasks filter: any of these people (member ids or "me") and statuses; overdue only
    assignees?: string[];
    statuses?: string[];
    overdue?: boolean;
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

const joined = (values: string[] | undefined, sort = true) =>
    values?.length ? (sort ? [...values].sort() : values).join(",") : undefined;
const bool = (value: boolean | undefined) => (value === undefined ? undefined : String(value) as "true" | "false");

// The list query's parameters as the API takes them (also the key that caches them)
const listQuery = ({ workspaceId, ids, excludeProjects, assignees, statuses, ...params }: Omit<UseGetTasksProps, "enabled">) => ({
    workspaceId,
    projectId: params.projectId ?? undefined,
    status: params.status ?? undefined,
    assigneeId: params.assigneeId ?? undefined,
    search: params.search ?? undefined,
    scope: params.scope,
    weekFrom: params.weekFrom,
    weekTo: params.weekTo,
    from: params.from,
    to: params.to,
    unscheduled: bool(params.unscheduled),
    openOnly: bool(params.openOnly),
    starred: params.starred ? "true" as const : undefined,
    overdue: params.overdue ? "true" as const : undefined,
    assignees: joined(assignees),
    statuses: joined(statuses),
    ids: joined(ids),
    excludeProjects: joined(excludeProjects),
    limit: params.limit?.toString(),
    offset: params.offset?.toString(),
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    doneLimit: params.doneLimit?.toString(),
});

export const useGetTasks = ({ enabled = true, ...props }: UseGetTasksProps) => {
    const query = listQuery(props);
    const { workspaceId, ids } = props;
    return useAppQuery({
        // Every parameter is part of the key; "tasks" first, so task changes refresh them all.
        // (The third part keeps the original fields, e.g. starred, which the star toggle looks for.)
        queryKey: ["tasks", workspaceId, { ...query, starred: props.starred || undefined }],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId) && enabled && (ids === undefined || Boolean(query.ids)),
        // Keep showing the current list while a new filter, page or range loads, but never
        // another workspace's tasks
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[1] === workspaceId ? keepPreviousData(previous) : undefined,
        queryFn: async () => {
            const response = await client.api.tasks.$get({ query });
            if (!response.ok) {
                throw new ApiError("Failed to fetch tasks", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};

// The counts on My Tasks' filter chips, for the same query as the list
export const useGetTaskFacets = ({ enabled = true, ...props }: UseGetTasksProps) => {
    const query = listQuery({ ...props, limit: undefined, offset: undefined, sortBy: undefined, sortDir: undefined });
    return useAppQuery({
        queryKey: ["tasks", props.workspaceId, "facets", { ...query, starred: props.starred || undefined }],
        enabled: Boolean(props.workspaceId) && enabled,
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const response = await client.api.tasks.facets.$get({ query });
            if (!response.ok) {
                throw new ApiError("Failed to fetch the filter counts", response.status);
            }
            return (await response.json()).data;
        },
    });
};

// Home's counts for this week (server-side, so they stay quick however many tasks there are).
// filter: the saved My Tasks filter and hidden projects, which Home follows
export const useGetTaskSummary = ({ workspaceId, filter = {} }: {
    workspaceId: string;
    filter?: Pick<UseGetTasksProps, "assignees" | "statuses" | "starred" | "overdue" | "excludeProjects">;
}) => {
    const { weekFrom, weekTo } = useCurrentWeek();
    const { assignees, statuses, starred, overdue, excludeProjects } = listQuery({ workspaceId, ...filter });
    const saved = { assignees, statuses, starred, overdue, excludeProjects };
    return useAppQuery({
        // Under "tasks", so any task change refreshes it too
        queryKey: ["tasks", workspaceId, "summary", weekFrom, saved],
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api.tasks.summary.$get({ query: { workspaceId, weekFrom, weekTo, ...saved } });
            if (!response.ok) {
                throw new ApiError("Failed to fetch the task summary", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};
