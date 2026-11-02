import { useCallback, useSyncExternalStore } from "react";

// This visit's values, so a flag still changes when storage is unavailable (private mode)
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
};
const read = (key: string) => {
    if (memory.has(key)) return memory.get(key)!;
    try {
        return localStorage.getItem(key) === "1";
    } catch {
        return false;
    }
};

// An on/off setting kept in this browser. `serverValue` is used until hydration, so the server
// and the first client render agree.
export const useStoredFlag = (key: string, serverValue: boolean) => {
    const value = useSyncExternalStore(subscribe, () => read(key), () => serverValue);
    const set = useCallback((next: boolean) => {
        memory.set(key, next);
        try {
            localStorage.setItem(key, next ? "1" : "0");
        } catch {
            // Kept for this visit only
        }
        listeners.forEach((listener) => listener());
    }, [key]);
    return [value, set] as const;
};
