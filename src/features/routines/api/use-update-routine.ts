import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.routines[":routineId"]["$patch"], 200>;
type RequestType = InferRequestType<typeof client.api.routines[":routineId"]["$patch"]>;

export const useUpdateRoutine = () => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ json, param }) => {
            const response = await client.api.routines[":routineId"]["$patch"]({ json, param });
            if (!response.ok) {
                throw new Error("Routine update failed");
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success("Routine updated");
            queryClient.invalidateQueries({ queryKey: ["routines"] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
        onError: () => {
            toast.error("Failed to update routine");
        },
    });
};
