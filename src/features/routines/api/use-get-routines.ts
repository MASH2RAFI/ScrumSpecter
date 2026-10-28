import { useAppQuery } from "@/lib/use-app-query";
import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

interface UseGetRoutinesProps {
    workspaceId: string;
}

export const useGetRoutines = ({ workspaceId }: UseGetRoutinesProps) => {
    return useAppQuery({
        queryKey: ["routines", workspaceId],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api.routines.$get({ query: { workspaceId } });
            if (!response.ok) {
                throw new ApiError("Failed to fetch routines", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};
