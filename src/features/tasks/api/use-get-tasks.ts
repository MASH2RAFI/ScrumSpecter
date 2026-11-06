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
export const currentWeek = (weekStart: 0 | 1 | 6, now = new Date()) => {
    const { start, end } = weekRange(now, weekStart);
    return { weekFrom: start.toISOString(), weekTo: end.toISOString() };
};

export const useCurrentWeek = () => {
    const { weekStart } = usePreferences();
    // Recomputed when the day changes, not on every render
    const day = new Date().toDateString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => currentWeek(weekStart), [weekStart, day]);
};

const joined = (values: string[] | undefined, sort = true) =>
    values?.length ? (sort ? [...values].sort() : values).join(",") : undefined;
const bool = (value: boolean | undefined) => (value === undefined ? undefined : String(value) as "true" | "false");

// The list query's parameters as the API takes them (also the key that caches them)
export const listQuery = ({ workspaceId, ids, excludeProjects, assignees, statuses, ...params }: Omit<UseGetTasksProps, "enabled">) => ({
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

// Every parameter is part of the key; "tasks" first, so task changes refresh them all.
// (The third part keeps the original fields, e.g. starred, which the star toggle looks for.)
export const taskListKey = (props: Omit<UseGetTasksProps, "enabled">) =>
    ["tasks", props.workspaceId, { ...listQuery(props), starred: props.starred || undefined }] as const;

export const taskFacetsKey = (props: Omit<UseGetTasksProps, "enabled">) =>
    ["tasks", props.workspaceId, "facets", { ...listQuery({ ...props, limit: undefined, offset: undefined, sortBy: undefined, sortDir: undefined }), starred: props.starred || undefined }] as const;

// Home's numbers come from the clock as well as from edits (a task becomes overdue as time passes,
// and no edit says so), so they are re-asked after this long when the page opens or the tab is
// used again. Everything else is kept until a data version changes.
export const TIME_DEPENDENT_STALE_MS = 5 * 60_000;
const timeDependent = { staleTime: TIME_DEPENDENT_STALE_MS, refetchOnWindowFocus: true } as const;

export const useGetTasks = ({ enabled = true, ...props }: UseGetTasksProps) => {
    const query = listQuery(props);
    const { workspaceId, ids } = props;
    return useAppQuery({
        queryKey: taskListKey(props),
        ...(props.scope === "home" ? timeDependent : {}),
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
        queryKey: taskFacetsKey(props),
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
type SummaryFilter = Pick<UseGetTasksProps, "assignees" | "statuses" | "starred" | "overdue" | "excludeProjects">;

// The filter part of the summary's request, as the API takes it
export const summarySaved = (workspaceId: string, filter: SummaryFilter = {}) => {
    const { assignees, statuses, starred, overdue, excludeProjects } = listQuery({ workspaceId, ...filter });
    return { assignees, statuses, starred, overdue, excludeProjects };
};

// Under "tasks", so any task change refreshes it too
export const taskSummaryKey = (workspaceId: string, weekFrom: string, filter: SummaryFilter = {}) =>
    ["tasks", workspaceId, "summary", weekFrom, summarySaved(workspaceId, filter)] as const;

export const useGetTaskSummary = ({ workspaceId, filter = {} }: {
    workspaceId: string;
    filter?: SummaryFilter;
}) => {
    const { weekFrom, weekTo } = useCurrentWeek();
    const saved = summarySaved(workspaceId, filter);
    return useAppQuery({
        queryKey: taskSummaryKey(workspaceId, weekFrom, filter),
        ...timeDependent,
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
