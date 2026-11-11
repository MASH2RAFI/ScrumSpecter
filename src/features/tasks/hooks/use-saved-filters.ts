"use client";

import { usePreferences, useSavePreferences } from "@/features/auth/hooks/use-preferences";
import {
    EMPTY_ROUTINE_FILTER, EMPTY_TASK_FILTER,
    type RoutineFilter, type TaskFilter,
} from "@/features/auth/preferences-core";

// The My Tasks filter for this workspace, saved on the account (Home follows it); on a project's
// page, that project's own filter instead
export const useTaskFilter = (workspaceId: string, projectId?: string | null) => {
    const { taskFilters, projectFilters, hiddenProjects } = usePreferences();
    const save = useSavePreferences();
    const filter = (projectId ? projectFilters[projectId] : taskFilters[workspaceId]) ?? EMPTY_TASK_FILTER;
    const setFilter = (changes: Partial<TaskFilter>) => save(projectId
        ? { projectFilters: { [projectId]: { ...filter, ...changes } } }
        : { taskFilters: { [workspaceId]: { ...filter, ...changes } } });
    return { filter, setFilter, hiddenProjects };
};

// The Routines page's own filter for this workspace (independent of My Tasks)
export const useRoutineFilter = (workspaceId: string) => {
    const { routineFilters } = usePreferences();
    const save = useSavePreferences();
    const filter = routineFilters[workspaceId] ?? EMPTY_ROUTINE_FILTER;
    const setFilter = (changes: Partial<RoutineFilter>) =>
        save({ routineFilters: { [workspaceId]: { ...filter, ...changes } } });
    return { filter, setFilter };
};
