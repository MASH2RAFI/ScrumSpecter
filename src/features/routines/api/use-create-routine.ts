import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.routines["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.routines["$post"]>;

export const useCreateRoutine = () => {
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ json }) => {
            const response = await client.api.routines["$post"]({ json });
            if (!response.ok) {
                throw new Error("Routine creation failed");
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success("Routine created");
            queryClient.invalidateQueries({ queryKey: ["routines"] });
            // This week's occurrences were just added to the board
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
        onError: () => {
            toast.error("Failed to create routine");
        },
    });
};
