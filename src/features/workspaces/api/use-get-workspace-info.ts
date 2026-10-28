import { useAppQuery } from "@/lib/use-app-query";
import { client } from "@/lib/rpc";

interface UseGetWorkspaceInfoProps {
    workspaceId: string;
}

export const useGetWorkspaceInfo = ({ workspaceId }: UseGetWorkspaceInfoProps) => {
    return useAppQuery({
        queryKey: ["workspace-info", workspaceId],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api.workspaces[":workspaceId"]["info"].$get({ param: { workspaceId } });
            if (!response.ok) {
                throw new Error("Failed to fetch workspace info");
            }
            const { data } = await response.json();
            return data;
        },
    });
};
