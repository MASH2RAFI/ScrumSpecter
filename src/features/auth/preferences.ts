import { z } from "zod";

import { isValidTimeZone } from "@/lib/time-zone";

// Per-user settings, stored in users.preferences (jsonb); shared by the server and the client

export const TASK_VIEWS = ["table", "kanban", "calendar"] as const;

export const preferencesSchema = z.object({
    defaultTaskView: z.enum(TASK_VIEWS),
    // JS day number the week starts on: 6 = Saturday, 0 = Sunday, 1 = Monday
    weekStart: z.union([z.literal(6), z.literal(0), z.literal(1)]),
    timeFormat: z.enum(["12h", "24h"]),
    // IANA zone reminders are timed in (6 PM summary, 5:30 PM for date-only tasks);
    // saved from the browser automatically
    timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone"),
    // 6 PM summary of tomorrow's tasks
    remindDayBefore: z.boolean(),
    // 30 minutes before a task ends
    remindBeforeEnd: z.boolean(),
    // The welcome tour on first sign-in; new accounts start with it on, everyone else off
    showTutorial: z.boolean(),
});

export type UserPreferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: UserPreferences = {
    defaultTaskView: "table",
    weekStart: 6,
    timeFormat: "12h",
    timeZone: "Asia/Dhaka",
    remindDayBefore: true,
    remindBeforeEnd: true,
    showTutorial: false,
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
