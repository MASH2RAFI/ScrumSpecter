"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "scrumspecter-calendar-prefs";

export const SLOT_STEP = 30;
export const MIN_SLOT = 30;
export const MAX_SLOT = 240;

export type CalendarPrefs = {
    // Week/day grid row size in minutes: 30, 60, 90 ... 240
    slotMinutes: number;
    // Visible hours in week/day views, [startHour, endHour)
    startHour: number;
    endHour: number;
    showUnscheduled: boolean;
};

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
    slotMinutes: 30,
    startHour: 0,
    endHour: 24,
    showUnscheduled: true,
};

const clampSlot = (minutes: number) =>
    Math.min(MAX_SLOT, Math.max(MIN_SLOT, Math.round(minutes / SLOT_STEP) * SLOT_STEP));

// Stored values may be partial or invalid (hand-edited, older shape); repair rather than reject
const sanitize = (raw: Partial<CalendarPrefs>): CalendarPrefs => {
    const prefs = { ...DEFAULT_CALENDAR_PREFS, ...raw };
    const startHour = Math.min(23, Math.max(0, Math.floor(Number(prefs.startHour) || 0)));
    const endHour = Math.min(24, Math.max(startHour + 1, Math.floor(Number(prefs.endHour) || 24)));
    return {
        slotMinutes: clampSlot(Number(prefs.slotMinutes) || DEFAULT_CALENDAR_PREFS.slotMinutes),
        startHour,
        endHour,
        showUnscheduled: prefs.showUnscheduled !== false,
    };
};

// Per-device calendar layout (not per account: a phone and a big monitor want different grids)
export const useCalendarPrefs = () => {
    // Read after mount so server and client render the same first frame
    const [prefs, setPrefs] = useState(DEFAULT_CALENDAR_PREFS);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setPrefs(sanitize(JSON.parse(stored)));
        } catch {
            // Unavailable or corrupt storage: keep the defaults
        }
    }, []);

    const update = useCallback((changes: Partial<CalendarPrefs>) => {
        setPrefs((current) => {
            const next = sanitize({ ...current, ...changes });
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Not persisted; still applies for this visit
            }
            return next;
        });
    }, []);

    return { prefs, update };
};
