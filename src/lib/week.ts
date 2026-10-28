import { addDays, startOfWeek } from "date-fns";

import { DEFAULT_PREFERENCES, type UserPreferences } from "@/features/auth/preferences";

export type WeekStart = UserPreferences["weekStart"];

export const DEFAULT_WEEK_START: WeekStart = DEFAULT_PREFERENCES.weekStart;

// Local-time bounds of the week containing `date`: [start, end)
export const weekRange = (date: Date, weekStart: WeekStart = DEFAULT_WEEK_START) => {
    const start = startOfWeek(date, { weekStartsOn: weekStart });
    return { start, end: addDays(start, 7) };
};

// ISO weekday numbers (1 = Monday ... 7 = Sunday) in display order for this week start
export const isoWeekdayOrder = (weekStart: WeekStart = DEFAULT_WEEK_START) =>
    Array.from({ length: 7 }, (_, i) => ((weekStart + i + 6) % 7) + 1);
