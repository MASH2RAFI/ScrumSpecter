import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";
import { useAppQuery } from "@/lib/use-app-query";

export type StarItem = { taskId: string } | { routineId: string };
type StarIds = { taskIds: string[]; routineIds: string[] };

export const useGetStarIds = (workspaceId: string) => useAppQuery({
    queryKey: ["stars", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
        const response = await client.api.stars.ids.$get({ query: { workspaceId } });
        if (!response.ok) throw new ApiError("Failed to fetch stars", response.status);
        return (await response.json()).data as StarIds;
    },
});

// Optimistic: the star fills at once and rolls back with a toast if the server says no
export const useToggleStar = (workspaceId: string) => {
    const queryClient = useQueryClient();
    const key = ["stars", workspaceId];

    return useMutation({
        mutationFn: async ({ item, starred }: { item: StarItem; starred: boolean }) => {
            const response = starred
                ? await client.api.stars.$post({ json: item })
                : await client.api.stars.$delete({ json: item });
            if (!response.ok) throw new ApiError(starred ? "Couldn't star it" : "Couldn't unstar it", response.status);
        },
        onMutate: async ({ item, starred }) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous = queryClient.getQueryData<StarIds>(key);
            const [field, id] = "taskId" in item ? ["taskIds", item.taskId] as const : ["routineIds", item.routineId] as const;
            if (previous) {
                const ids = previous[field].filter((other) => other !== id);
                queryClient.setQueryData<StarIds>(key, { ...previous, [field]: starred ? [...ids, id] : ids });
            }
            return { previous };
        },
        onError: (error, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(key, context.previous);
            toast.error(error.message);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["stars"] });
            // Task lists filtered to starred ones change with every star
            queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "tasks"
                && (query.queryKey[2] as { starred?: boolean } | undefined)?.starred === true });
        },
    });
};
