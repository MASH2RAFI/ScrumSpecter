import { useCallback, useSyncExternalStore } from "react";

// True while the media query matches; `serverValue` is used before hydration
export const useMediaQuery = (query: string, serverValue = false) => {
    // Stable per query, so React doesn't re-subscribe on every render
    const subscribe = useCallback((onChange: () => void) => {
        const list = window.matchMedia(query);
        list.addEventListener("change", onChange);
        return () => list.removeEventListener("change", onChange);
    }, [query]);
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverValue);
};
