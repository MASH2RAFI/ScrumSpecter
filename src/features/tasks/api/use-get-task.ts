import { useAppQuery } from "@/lib/use-app-query";
import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

interface UseGetTaskProps {
    taskId: string;
};

export const useGetTask = ({
    taskId,
}: UseGetTaskProps) => {
    const query = useAppQuery({
        queryKey: ["task", taskId],
        // Skip the request until the route has an id (e.g. no workspace selected yet)
        enabled: Boolean(taskId),
        queryFn: async () => {
            const response = await client.api.tasks[":taskId"].$get({
                param: {
                    taskId
                }
            });

            if (!response.ok) {
                throw new ApiError("Failed to fetch task", response.status);
            }

            const { data } = await response.json();
            return data;
        },
    });
    return query;
};
