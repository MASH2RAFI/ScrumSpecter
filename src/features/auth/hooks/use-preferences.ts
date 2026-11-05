"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { useUpdatePreferences } from "@/features/account/api/use-account";

import { useCurrent } from "../api/use-current";
import { DATE_FORMATS, DEFAULT_PREFERENCES, mergePreferenceChanges, resolvePreferences, type PreferenceChanges } from "../preferences";

// The signed-in user's preferences, or the defaults while loading / signed out
export const usePreferences = () => {
    const { data: user } = useCurrent();
    return user ? resolvePreferences(user.preferences) : DEFAULT_PREFERENCES;
};

// Background save (no toast) of a setting changed in place, like a project's eye
export const useSavePreferences = () => {
    const queryClient = useQueryClient();
    const { mutate } = useUpdatePreferences({ silent: true });

    // For the saved filters, `changes` holds only the entries being changed (the server merges them)
    return (changes: PreferenceChanges) => {
        // Into the cached user at once, so the views update before the save comes back
        queryClient.setQueryData<{ preferences: Record<string, unknown> } | null>(["current"], (current) =>
            current ? { ...current, preferences: mergePreferenceChanges(current.preferences, changes) } : current);
        mutate(changes);
    };
};

// A date with its year, in the person's chosen date format
export const useFormatDate = () => {
    const pattern = DATE_FORMATS[usePreferences().dateFormat];
    return (date: Date | string) => format(new Date(date), pattern);
};
