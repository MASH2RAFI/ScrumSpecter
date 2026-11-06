"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { primeRequests } from "@/lib/batch-fetch";
import { lowData } from "@/lib/low-data";

import { pageRequestUrls } from "../page-requests";

// For the links to a workspace's pages: the moment the pointer reaches one, or it takes keyboard
// focus, that page's requests are on their way (one batch), so the click finds them answered. Pages
// whose data is already in the browser, unknown pages and Data Saver do nothing.
export const usePrefetchPage = () => {
    const queryClient = useQueryClient();
    const preferences = usePreferences();

    return useCallback((workspaceId: string, href: string) => {
        if (!workspaceId || lowData()) return;
        primeRequests(pageRequestUrls(queryClient, workspaceId, href, preferences));
    }, [queryClient, preferences]);
};
