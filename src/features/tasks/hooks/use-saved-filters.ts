"use client";

import { usePreferences, useSavePreferences } from "@/features/auth/hooks/use-preferences";
import {
    EMPTY_ROUTINE_FILTER, EMPTY_TASK_FILTER,
    type RoutineFilter, type TaskFilter,
} from "@/features/auth/preferences";

// The My Tasks filter for this workspace, saved on the account (Home follows it)
export const useTaskFilter = (workspaceId: string) => {
    const { taskFilters, hiddenProjects } = usePreferences();
    const save = useSavePreferences();
    const filter = taskFilters[workspaceId] ?? EMPTY_TASK_FILTER;
    const setFilter = (changes: Partial<TaskFilter>) =>
        save({ taskFilters: { ...taskFilters, [workspaceId]: { ...filter, ...changes } } });
    return { filter, setFilter, hiddenProjects };
};

// The Routines page's own filter for this workspace (independent of My Tasks)
export const useRoutineFilter = (workspaceId: string) => {
    const { routineFilters } = usePreferences();
    const save = useSavePreferences();
    const filter = routineFilters[workspaceId] ?? EMPTY_ROUTINE_FILTER;
    const setFilter = (changes: Partial<RoutineFilter>) =>
        save({ routineFilters: { ...routineFilters, [workspaceId]: { ...filter, ...changes } } });
    return { filter, setFilter };
};

// The saved filter as list-query parameters
export const taskFilterQuery = (filter: TaskFilter, hiddenProjects: string[]) => ({
    assignees: filter.people,
    statuses: filter.statuses,
    starred: filter.starred || undefined,
    overdue: filter.overdue || undefined,
    excludeProjects: hiddenProjects,
});
