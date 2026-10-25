import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

interface UseGetProjectsProps {
    workspaceId: string;
}

export const useGetProjects = ({ workspaceId }: UseGetProjectsProps) => {
    return useQuery({
        queryKey: ["projects", workspaceId],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api.projects.$get({ query: { workspaceId } });
            if (!response.ok) {
                throw new ApiError("Failed to fetch projects", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};
