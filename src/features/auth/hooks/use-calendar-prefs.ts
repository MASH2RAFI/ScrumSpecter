"use client";

import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { usePreferences, useSavePreferences } from "./use-preferences";

export type CalendarPrefs = {
    // Week/day grid row size in minutes: 30, 60, 90 ... 240
    slotMinutes: number;
    // Visible hours in week/day views, [startHour, endHour)
    startHour: number;
    endHour: number;
    showUnscheduled: boolean;
};

// "09:30" -> 9.5
const toHours = (time: string | null | undefined) => {
    const [hours, minutes] = (time ?? "").split(":").map(Number);
    return Number.isFinite(hours) ? hours + (minutes || 0) / 60 : null;
};

// The calendar's grid settings, saved on the account so they follow the person between devices.
// Visible hours the person hasn't set are the workspace's working hours (whole hours around them).
export const useCalendarPrefs = () => {
    const preferences = usePreferences();
    const save = useSavePreferences();
    const { data: workspace } = useGetWorkspace({ workspaceId: useWorkspaceId() });

    const workStart = toHours(workspace?.workDayStart);
    const workEnd = toHours(workspace?.workDayEnd);
    const workDay = workStart !== null && workEnd !== null && workEnd > workStart ? { start: workStart, end: workEnd } : null;
    const startHour = preferences.calendarStartHour ?? (workDay ? Math.floor(workDay.start) : 0);
    const endHour = Math.max(startHour + 1, preferences.calendarEndHour ?? (workDay ? Math.min(24, Math.ceil(workDay.end)) : 24));

    const prefs: CalendarPrefs = {
        slotMinutes: preferences.calendarSlotMinutes,
        startHour,
        endHour,
        showUnscheduled: preferences.calendarShowUnscheduled,
    };

    const update = (changes: Partial<CalendarPrefs>) => save({
        ...(changes.slotMinutes !== undefined && { calendarSlotMinutes: changes.slotMinutes }),
        ...(changes.startHour !== undefined && { calendarStartHour: changes.startHour }),
        ...(changes.endHour !== undefined && { calendarEndHour: changes.endHour }),
        ...(changes.showUnscheduled !== undefined && { calendarShowUnscheduled: changes.showUnscheduled }),
    });

    return { prefs, update };
};
