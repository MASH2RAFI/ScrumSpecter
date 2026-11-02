"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

import { AccountTheme } from "@/components/theme-provider";

import { useUpdatePreferences } from "@/features/account/api/use-account";
import { setHour12 } from "@/features/tasks/task-time";

import { useCurrent } from "../api/use-current";
import { usePreferences } from "../hooks/use-preferences";

// Applies preferences that live outside React state (the shared time formatter), and keeps
// the account's time zone (used to time reminders) in step with this browser's
export const PreferencesSync = () => {
    const { timeFormat, timeZone, theme, reduceMotion } = usePreferences();
    const { data: user } = useCurrent();
    const { mutate: updatePreferences } = useUpdatePreferences({ silent: true });

    useEffect(() => {
        setHour12(timeFormat === "12h");
    }, [timeFormat]);

    // For CSS: globals.css settles transitions under html[data-reduce-motion], as for the system setting
    useEffect(() => {
        document.documentElement.toggleAttribute("data-reduce-motion", reduceMotion);
        return () => document.documentElement.removeAttribute("data-reduce-motion");
    }, [reduceMotion]);

    useEffect(() => {
        const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (user && browserZone && browserZone !== timeZone) {
            updatePreferences({ timeZone: browserZone });
        }
    }, [user, timeZone, updatePreferences]);

    return <AccountTheme theme={theme} />;
};

// The account's "Reduce motion" switch for Motion animations; nested MotionConfig keeps the root's other settings
export const AccountMotion = ({ children }: { children: ReactNode }) => {
    const { reduceMotion } = usePreferences();
    return <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>{children}</MotionConfig>;
};
