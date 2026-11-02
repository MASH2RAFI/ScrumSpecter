import { z } from "zod";

import { isValidTimeZone } from "@/lib/time-zone";

// Per-user settings, stored in users.preferences (jsonb); shared by the server and the client

export const TASK_VIEWS = ["table", "kanban", "calendar"] as const;
export const CALENDAR_VIEWS = ["month", "week", "day"] as const;

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

// My Tasks table's starting sort; "newest" is the server's own order
export const TASK_SORTS = ["newest", "dueDate", "name", "storyPoints"] as const;

export const preferencesSchema = z.object({
    defaultTaskView: z.enum(TASK_VIEWS),
    // JS day number the week starts on: 6 = Saturday, 0 = Sunday, 1 = Monday
    weekStart: z.union([z.literal(6), z.literal(0), z.literal(1)]),
    timeFormat: z.enum(["12h", "24h"]),
    // IANA zone reminders are timed in (6 PM summary, 5:30 PM for date-only tasks);
    // saved from the browser automatically
    timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone"),
    // Summary of tomorrow's tasks, at summaryTime (HH:MM, local) the day before
    remindDayBefore: z.boolean(),
    summaryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    // beforeEndMinutes before a task ends
    remindBeforeEnd: z.boolean(),
    beforeEndMinutes: z.union([z.literal(10), z.literal(15), z.literal(30), z.literal(60)]),
    // The welcome tour on first sign-in; new accounts start with it on, everyone else off
    showTutorial: z.boolean(),
    // Projects whose tasks My Tasks leaves out (the eye beside each project there)
    hiddenProjects: z.array(z.string().min(1).max(64)).max(200),
    // Projects whose routines the Routines page leaves out (its own list: hiding a project's
    // tasks in My Tasks shouldn't hide its routines)
    hiddenRoutineProjects: z.array(z.string().min(1).max(64)).max(200),
    // The calendar's starting view (the URL's ?cal= still wins)
    calendarView: z.enum(CALENDAR_VIEWS),
    calendarSlotMinutes: z.number().int().min(MIN_SLOT).max(MAX_SLOT).multipleOf(SLOT_STEP),
    // Visible hours in week/day views, [start, end); null = the workspace's working hours
    calendarStartHour: z.number().int().min(0).max(23).nullable(),
    calendarEndHour: z.number().int().min(1).max(24).nullable(),
    calendarShowUnscheduled: z.boolean(),
    // Where signing in lands, in the last-opened workspace
    landingPage: z.enum(["home", "my-tasks"]),
    // "device": each browser keeps its own switch; otherwise applied once on every device
    theme: z.enum(["device", "system", "light", "dark"]),
    // Always reduce motion, whatever the system says (off: follow the system)
    reduceMotion: z.boolean(),
    dateFormat: z.enum(Object.keys(DATE_FORMATS) as [keyof typeof DATE_FORMATS, ...(keyof typeof DATE_FORMATS)[]]),
    // My Tasks table: starting sort, rows per page, and whether Done tasks are listed
    taskSort: z.enum(TASK_SORTS),
    taskPageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
    showDoneInTable: z.boolean(),
    // Kanban: cards with the name only; empty columns narrowed to a strip (still drop targets)
    kanbanCompact: z.boolean(),
    kanbanShrinkEmpty: z.boolean(),
    // Secret in this person's calendar subscribe link (export feed); "" = no link yet. Set by the server only
    calendarFeedKey: z.string().max(64),
});

export type UserPreferences = z.infer<typeof preferencesSchema>;

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
};

// Stored values may be partial or from an older shape; anything invalid falls back to the default
export const resolvePreferences = (raw: unknown): UserPreferences => {
    const stored = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const result = { ...DEFAULT_PREFERENCES };
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof UserPreferences)[]) {
        const parsed = preferencesSchema.shape[key].safeParse(stored[key]);
        if (parsed.success) (result as Record<string, unknown>)[key] = parsed.data;
    }
    return result;
};
