import type { TaskFilter } from "@/features/auth/preferences";

// The saved filter as list-query parameters
export const taskFilterQuery = (filter: TaskFilter, hiddenProjects: string[]) => ({
    assignees: filter.people,
    statuses: filter.statuses,
    starred: filter.starred || undefined,
    overdue: filter.overdue || undefined,
    excludeProjects: hiddenProjects,
});
