"use client";

import { useEffect } from "react";

import { useUpdatePreferences } from "@/features/account/api/use-account";
import { setHour12 } from "@/features/tasks/task-time";

import { useCurrent } from "../api/use-current";
import { usePreferences } from "../hooks/use-preferences";

// Applies preferences that live outside React state (the shared time formatter), and keeps
// the account's time zone (used to time reminders) in step with this browser's
export const PreferencesSync = () => {
    const { timeFormat, timeZone } = usePreferences();
    const { data: user } = useCurrent();
    const { mutate: updatePreferences } = useUpdatePreferences({ silent: true });

    useEffect(() => {
        setHour12(timeFormat === "12h");
    }, [timeFormat]);

    useEffect(() => {
        const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (user && browserZone && browserZone !== timeZone) {
            updatePreferences({ timeZone: browserZone });
        }
    }, [user, timeZone, updatePreferences]);

    return null;
};
