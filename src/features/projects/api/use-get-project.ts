import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

interface UseGetProjectProps {
    projectId: string;
}

export const useGetProject = ({ projectId }: UseGetProjectProps) => {
    return useQuery({
        queryKey: ["project", projectId],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(projectId),
        queryFn: async () => {
            const response = await client.api.projects[":projectId"].$get({ param: { projectId } });
            if (!response.ok) {
                throw new ApiError("Failed to fetch project", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};
