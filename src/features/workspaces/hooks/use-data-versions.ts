"use client";

import { useEffect } from "react";
import { useIsRestoring, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { resumeReading, stopReading } from "@/lib/batch-fetch";
import { client } from "@/lib/rpc";
import { VERSIONS_QUERY_KEY } from "@/lib/query-cache";

type Versions = { workspaces: Record<string, number>; user: number; notifications: number };

const CHECK_INTERVAL = 60_000;

// Queries without a workspace id in their key (single task / project / workspace details)
const DETAIL_KEYS = ["task", "project", "workspace", "workspace-info"];

const fetchVersions = async (): Promise<Versions | null> => {
    const response = await client.api.workspaces.versions.$get();
    if (!response.ok) return null;
    return (await response.json()).data;
};

let stopped = false;
let checkTimer: ReturnType<typeof setTimeout> | undefined;

// Signing out: the session is going away, so later checks would only get 401s
export const stopVersionChecks = () => {
    stopped = true;
    clearTimeout(checkTimer);
    stopReading();
};

export const resumeVersionChecks = () => {
    stopped = false;
    resumeReading();
};

// Compares the server's data versions with the last ones seen and refetches only what changed.
// A page opening triggers several checks at once (restored data, focus, visibility): they share the
// one that is running, and a check made moments ago counts. After your own change (`force`) a new
// one always runs, once the current one is over, because that one may have started before the
// change was saved.
const MIN_GAP = 1_000;
let running: Promise<void> | undefined;
let lastRun = 0;

export const syncVersions = (queryClient: QueryClient, { force = false } = {}): Promise<void> => {
    if (!force) {
        if (running) return running;
        if (Date.now() - lastRun < MIN_GAP) return Promise.resolve();
    }
    const run = (running ?? Promise.resolve()).then(() => compareVersions(queryClient)).catch(() => {}).finally(() => {
        lastRun = Date.now();
        if (running === run) running = undefined;
    });
    running = run;
    return run;
};

const compareVersions = async (queryClient: QueryClient) => {
    if (stopped) return;
    const latest = await fetchVersions().catch(() => null);
    // Signing out may have started while the request was away
    if (!latest || stopped) return;

    const seen = queryClient.getQueryData<Versions>(VERSIONS_QUERY_KEY);
    queryClient.setQueryData(VERSIONS_QUERY_KEY, latest);

    // First visit (or an older cache shape): nothing to compare with
    if (!seen?.workspaces) return;

    if (seen.user !== latest.user) {
        await queryClient.invalidateQueries({ queryKey: ["current"] });
    }
    if (seen.notifications !== latest.notifications) {
        await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }

    const changed = Object.keys(latest.workspaces).filter((id) => seen.workspaces[id] !== latest.workspaces[id]);
    const membershipChanged = Object.keys(seen.workspaces).length !== Object.keys(latest.workspaces).length
        || Object.keys(seen.workspaces).some((id) => !(id in latest.workspaces));

    if (membershipChanged) {
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    }
    if (changed.length === 0) return;

    await queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
            queryKey[0] !== VERSIONS_QUERY_KEY[0]
            && (DETAIL_KEYS.includes(queryKey[0] as string) || queryKey.some((part) => changed.includes(part as string))),
    });
};

// Called after this tab's mutations; debounced so a burst of edits costs one request. It is a
// normal check, not one that "absorbs" the new version: a teammate's change that lands just after
// ours moves the version too, and swallowing it left the lists without their change (not even a
// reload brought it back, the cache and its version agreeing) until something else changed. The
// price is one more refetch of what is on screen after an edit.
export const checkAfterOwnChange = (queryClient: QueryClient) => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => void syncVersions(queryClient, { force: true }), 500);
};

// Mounted once in the dashboard: check on load, on tab focus and every minute while visible
export const useDataVersions = () => {
    const queryClient = useQueryClient();
    // Compare against the restored cache, not an empty one still being read from storage
    const isRestoring = useIsRestoring();

    useEffect(() => {
        if (isRestoring) return;
        const check = () => {
            if (document.visibilityState === "visible") void syncVersions(queryClient);
        };
        check();
        const interval = setInterval(check, CHECK_INTERVAL);
        window.addEventListener("focus", check);
        document.addEventListener("visibilitychange", check);
        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", check);
            document.removeEventListener("visibilitychange", check);
        };
    }, [queryClient, isRestoring]);
};
