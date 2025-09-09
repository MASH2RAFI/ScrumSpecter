import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseIsAdminProps {
    workspaceId: string;
}

export const useIsAdmin = ({ workspaceId }: UseIsAdminProps) => {
    const query = useQuery({
        queryKey: ["isAdmin", workspaceId],
        queryFn: async () => {
            const response = await client.api.members["is-admin"].$get({
                query: {
                    workspaceId,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to check admin status");
            }

            const { data } = await response.json();
            return data;
        },
        enabled: !!workspaceId,
    });

    return {
        isAdmin: query.data || false,
        isLoading: query.isLoading,
        error: query.error,
    };
};
