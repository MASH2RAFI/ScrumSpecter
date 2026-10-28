"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Renders children only in the browser. The dashboard reads the browser's cached data,
// which the server never has, so hydrating it would mismatch; the server sends the fallback.
export const ClientOnly = ({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) => {
    const isClient = useSyncExternalStore(subscribe, () => true, () => false);
    return isClient ? <>{children}</> : <>{fallback}</>;
};
