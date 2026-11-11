import type { HiddenToggle, RoutineFilter, TaskFilter, UserPreferences } from "./preferences";

export type { HiddenToggle, PreferenceChanges, RoutineFilter, TaskFilter, UserPreferences } from "./preferences";

// IF YOU REMOVE OR RENAME A VALUE a preference may hold (a calendar view, a sort...), change CACHE_BUSTER in
// src/lib/query-cache.ts in the same change: the browser keeps a saved copy for up to 7 days and, unlike the
// server, no longer validates it, so an old copy would show the value that no longer exists.
// What the browser needs from the account's preferences without the validation (zod) that the server uses:
// preferences.ts holds the schema and re-exports all of this, so server code imports from there as before.
// The browser gets preferences the server has already validated, so it only fills in what is missing.

export const TASK_VIEWS = ["table", "kanban", "calendar"] as const;
export const CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;
// "agenda" is the calendar library's dated list (14 days); phones open it by default
export const CALENDAR_VIEW_LABELS: Record<(typeof CALENDAR_VIEWS)[number], string> = { month: "Month", week: "Week", day: "Day", agenda: "List" };

// Calendar week/day grid row size, in minutes
export const SLOT_STEP = 30;
export const MIN_SLOT = 30;
export const MAX_SLOT = 240;

// date-fns patterns for dates with a year; "long" is the original look
export const DATE_FORMATS = {
    long: "PPP",
    medium: "d MMM yyyy",
    dmy: "dd/MM/yyyy",
    mdy: "MM/dd/yyyy",
    iso: "yyyy-MM-dd",
} as const;


export const ROUTINE_TAGS = ["active", "paused", "starred", "personal"] as const;

// Saved filters are kept per workspace (at most 50 workspaces) and per project (at most 200)
export const MAP_LIMITS = { taskFilters: 50, routineFilters: 50, projectFilters: 200 } as const;

// My Tasks table's starting sort; "newest" is the server's own order
export const TASK_SORTS = ["newest", "dueDate", "name", "storyPoints"] as const;

export const EMPTY_TASK_FILTER: TaskFilter = { people: [], statuses: [], starred: false, overdue: false };
export const EMPTY_ROUTINE_FILTER: RoutineFilter = { people: [], tags: [] };

// The longest a hidden-projects list may be (the schema's own limit)
export const HIDDEN_LIST_LIMIT = 200;

export const DEFAULT_PREFERENCES: UserPreferences = {
    defaultTaskView: "table",
    weekStart: 6,
    timeFormat: "12h",
    timeZone: "Asia/Dhaka",
    remindDayBefore: true,
    summaryTime: "18:00",
    remindBeforeEnd: true,
    beforeEndMinutes: 30,
    showTutorial: false,
    hiddenProjects: [],
    hiddenRoutineProjects: [],
    calendarView: "month",
    calendarSlotMinutes: 30,
    calendarStartHour: null,
    calendarEndHour: null,
    calendarShowUnscheduled: true,
    landingPage: "home",
    theme: "device",
    reduceMotion: false,
    calendarFeedKey: "",
    dateFormat: "long",
    taskSort: "newest",
    taskPageSize: 25,
    showDoneInTable: true,
    kanbanCompact: false,
    kanbanShrinkEmpty: false,
    taskFilters: {},
    routineFilters: {},
    projectFilters: {},
};


// What the browser shows for a stored copy: the server has already validated it (lib/auth.ts), so only
// settings an older copy doesn't have yet are filled in with their defaults
export const withDefaults = (raw: unknown): UserPreferences =>
    ({ ...DEFAULT_PREFERENCES, ...(raw && typeof raw === "object" ? raw as Partial<UserPreferences> : {}) });

// A save of one of the keyed maps (taskFilters, routineFilters, projectFilters) carries only the
// entries it changes, and they are merged into the stored map one level down. Sending the whole map
// from a device's copy let a second device's save of another workspace's filter wipe the first's.
// Used by the server (the stored value) and the browser (the cached copy), so they agree.
export const mergePreferenceChanges = (current: Record<string, unknown>, changes: Record<string, unknown>) => {
    const { hiddenToggle, ...rest } = changes as { hiddenToggle?: HiddenToggle } & Record<string, unknown>;
    const merged: Record<string, unknown> = { ...current, ...rest };
    // One project's eye: add or remove just that id in the list, not the whole list from a device's copy
    if (hiddenToggle) {
        const list = new Set((merged[hiddenToggle.list] as string[] | undefined) ?? []);
        if (hiddenToggle.hidden) list.add(hiddenToggle.id);
        else list.delete(hiddenToggle.id);
        merged[hiddenToggle.list] = [...list];
    }
    for (const key of Object.keys(MAP_LIMITS)) {
        const change = changes[key];
        if (change && typeof change === "object") {
            merged[key] = { ...(current[key] as Record<string, unknown> | undefined), ...(change as Record<string, unknown>) };
        }
    }
    return merged;
};
