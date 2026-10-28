"use client";

import { useCurrent } from "../api/use-current";
import { DEFAULT_PREFERENCES, resolvePreferences } from "../preferences";

// The signed-in user's preferences, or the defaults while loading / signed out
export const usePreferences = () => {
    const { data: user } = useCurrent();
    return user ? resolvePreferences(user.preferences) : DEFAULT_PREFERENCES;
};
