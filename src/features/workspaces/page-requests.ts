import type { QueryClient } from "@tanstack/react-query";

import { EMPTY_TASK_FILTER, type UserPreferences } from "@/features/auth/preferences";
import { currentWeek, listQuery, taskListKey, taskSummaryKey } from "@/features/tasks/api/use-get-tasks";
import { DEFAULT_SORTS } from "@/features/tasks/default-sorts";
import { client } from "@/lib/rpc";

import { homePageUrls, homeTaskParams } from "./home-requests";

export type PagePreferences = Pick<UserPreferences, "weekStart" | "taskFilters" | "hiddenProjects" | "defaultTaskView" | "taskSort" | "taskPageSize" | "showDoneInTable">;

const asPath = (url: URL) => url.pathname + url.search;

// The Tasks page as it opens by default: the table, with the saved filter and the account's sort and
// page size (no link filters, search or sorting yet). Mirrors TableView and the filter row.
export const tasksTableParams = (workspaceId: string, preferences: PagePreferences, now = new Date()) => {
    const filter = preferences.taskFilters[workspaceId] ?? EMPTY_TASK_FILTER;
    const base = {
        workspaceId,
        excludeProjects: preferences.hiddenProjects,
        assignees: filter.people,
        statuses: filter.statuses,
        starred: filter.starred || undefined,
        overdue: filter.overdue || undefined,
    };
    const list = {
        ...base,
        ...currentWeek(preferences.weekStart, now),
        scope: "table" as const,
        limit: preferences.taskPageSize,
        offset: 0,
        ...DEFAULT_SORTS[preferences.taskSort],
        openOnly: !preferences.showDoneInTable && !filter.statuses.length ? true : undefined,
    };
    return { base, list };
};

// What a page of the sidebar will ask for when it opens, for the ones whose requests are known
// (Home, and the Tasks table), unless that is already in the browser. The shell's own requests
// (people, projects, bell) are already loaded by then.
export const pageRequestUrls = (queryClient: QueryClient, workspaceId: string, href: string, preferences: PagePreferences, now = new Date()): string[] => {
    if (href === "") {
        const { week, followed } = homeTaskParams(workspaceId, preferences, now);
        if (queryClient.getQueryData(taskSummaryKey(workspaceId, week.weekFrom, followed)) !== undefined) return [];
        return homePageUrls(workspaceId, preferences, now);
    }
    if (href === "/tasks" && preferences.defaultTaskView === "table") {
        const { base, list } = tasksTableParams(workspaceId, preferences, now);
        if (queryClient.getQueryData(taskListKey(list)) !== undefined) return [];
        return [
            client.api.tasks.$url({ query: listQuery(list) }),
            // (the filter row counts the same tasks the table lists, so it asks with the table's scope and week)
            client.api.tasks.facets.$url({ query: listQuery({ ...base, scope: list.scope, weekFrom: list.weekFrom, weekTo: list.weekTo }) }),
            client.api.stars.ids.$url({ query: { workspaceId } }),
        ].map(asPath);
    }
    return [];
};
