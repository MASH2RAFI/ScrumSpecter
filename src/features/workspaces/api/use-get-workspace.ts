import { useAppQuery } from "@/lib/use-app-query";
import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

interface UseGetWorkspaceProps {
    workspaceId: string;
}

export const useGetWorkspace = ({ workspaceId }: UseGetWorkspaceProps) => {
    return useAppQuery({
        queryKey: ["workspace", workspaceId],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api.workspaces[":workspaceId"].$get({ param: { workspaceId } });
            if (!response.ok) {
                throw new ApiError("Failed to fetch workspace", response.status);
            }
            const { data } = await response.json();
            return data;
        },
    });
};
