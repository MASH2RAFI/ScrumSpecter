import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.routines[":routineId"]["$delete"], 200>;
type RequestType = InferRequestType<typeof client.api.routines[":routineId"]["$delete"]>;

export const useDeleteRoutine = () => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ param }) => {
            const response = await client.api.routines[":routineId"]["$delete"]({ param });
            if (!response.ok) {
                throw new Error("Routine deletion failed");
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success("Routine deleted");
            queryClient.invalidateQueries({ queryKey: ["routines"] });
        },
        onError: () => {
            toast.error("Failed to delete routine");
        },
    });
};
