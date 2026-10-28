import { useAppQuery } from "@/lib/use-app-query";
import { client } from "@/lib/rpc";

export const useGetWorkspaces = () => {
    return useAppQuery({
        queryKey: ["workspaces"],
        queryFn: async () => {
            const response = await client.api.workspaces.$get();
            if (!response.ok) {
                throw new Error("Failed to fetch workspaces");
            }
            const { data } = await response.json();
            return data;
        },
    });
};
