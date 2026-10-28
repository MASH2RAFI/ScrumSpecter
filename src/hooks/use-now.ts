"use client";

import { useEffect, useState } from "react";

// The current time, refreshed every `intervalMs`, for countdowns
export const useNow = (intervalMs = 30_000) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(interval);
    }, [intervalMs]);

    return now;
};
