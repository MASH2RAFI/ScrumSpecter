"use client";

import { useEffect } from "react";
import { useIsRestoring, useQueryClient, type QueryClient } from "@tanstack/react-query";

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

// Signing out: the session is going away, so later checks would only get 401s
export const stopVersionChecks = () => {
    stopped = true;
};

export const resumeVersionChecks = () => {
    stopped = false;
};

// Compares the server's data versions with the last ones seen and refetches only what changed
export const syncVersions = async (queryClient: QueryClient, { absorb = false } = {}) => {
    if (stopped) return;
    const latest = await fetchVersions().catch(() => null);
    if (!latest) return;

    const seen = queryClient.getQueryData<Versions>(VERSIONS_QUERY_KEY);
    queryClient.setQueryData(VERSIONS_QUERY_KEY, latest);

    // First visit (or an older cache shape), or the change came from this tab's own mutation
    if (!seen?.workspaces || absorb) return;

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

let absorbTimer: ReturnType<typeof setTimeout> | undefined;

// Called after this tab's mutations; debounced so a burst of edits costs one request
export const absorbOwnChanges = (queryClient: QueryClient) => {
    clearTimeout(absorbTimer);
    absorbTimer = setTimeout(() => void syncVersions(queryClient, { absorb: true }), 500);
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
