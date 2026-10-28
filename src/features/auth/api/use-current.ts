import { useAppQuery } from "@/lib/use-app-query";
import { client } from "@/lib/rpc";
import { clearPersistedCache } from "@/lib/query-cache";

// Cached like everything else; account changes invalidate ["current"] themselves
export const useCurrent = () => {
    return useAppQuery({
        queryKey: ["current"],
        queryFn: async () => {
            const response = await client.api.auth.current.$get();
            if (!response.ok) {
                // Signed out (or the session expired): drop any stored copy of the old data
                if (response.status === 401) clearPersistedCache();
                return null;
            }
            const { user } = await response.json();
            return user;
        },
    });
};
