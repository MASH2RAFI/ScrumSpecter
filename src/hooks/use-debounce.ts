import { useEffect, useRef, type DependencyList } from "react";

// Runs `fn` once `deps` have stopped changing for `ms` milliseconds
export const useDebounce = (fn: () => void, ms: number, deps: DependencyList) => {
    const latest = useRef(fn);
    // Keep the newest callback without restarting the timer
    useEffect(() => {
        latest.current = fn;
    });
    useEffect(() => {
        const timer = setTimeout(() => latest.current(), ms);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ms, ...deps]);
};
