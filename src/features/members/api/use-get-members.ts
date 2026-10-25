import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

interface UseGetMembersProps {
    workspaceId: string;
}

export const useGetMembers = ({ workspaceId }: UseGetMembersProps) => {
    return useQuery({
        queryKey: ["members", workspaceId],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api.members.$get({ query: { workspaceId } });
            if (!response.ok) {
                throw new ApiError("Failed to fetch members", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};
