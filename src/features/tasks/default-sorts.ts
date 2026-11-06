import type { UserPreferences } from "@/features/auth/preferences";

import type { UseGetTasksProps } from "./api/use-get-tasks";

// The account's starting sort (Account settings), used until a column header is clicked
export const DEFAULT_SORTS: Record<UserPreferences["taskSort"], { sortBy: UseGetTasksProps["sortBy"]; sortDir: "asc" | "desc" } | undefined> = {
    newest: undefined,
    dueDate: { sortBy: "dueDate", sortDir: "asc" },
    name: { sortBy: "name", sortDir: "asc" },
    storyPoints: { sortBy: "storyPoints", sortDir: "desc" },
};
