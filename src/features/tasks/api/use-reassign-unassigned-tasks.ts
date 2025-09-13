import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

type ResponseType = InferResponseType<typeof client.api.tasks["reassign-unassigned"]["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.tasks["reassign-unassigned"]["$post"]>;

export const useReassignUnassignedTasks = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ResponseType,
        Error,
        RequestType
    >({
        mutationFn: async ({ json }) => {
            const response = await client.api.tasks["reassign-unassigned"]["$post"]({ json });
            if (!response.ok) {
                const errorData = await response.json() as { error: string };
                throw new Error(errorData.error || "Failed to reassign unassigned tasks");
            }
            return await response.json();
        },
        onSuccess: (data) => {
            toast.success(`Successfully reassigned ${data.data.reassignedCount} unassigned tasks to admin.`);
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["members"] });
        },
        onError: (error) => {
            toast.error(error.message || "Failed to reassign unassigned tasks");
        }
    });

    return mutation;
};
