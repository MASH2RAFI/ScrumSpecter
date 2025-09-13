import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ResponseType = InferResponseType<typeof client.api.members["leave-workspace"]["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.members["leave-workspace"]["$post"]>;

export const useLeaveWorkspace = () => {
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation<
        ResponseType,
        Error,
        RequestType
    >({
        mutationFn: async ({ json }) => {
            const response = await client.api.members["leave-workspace"]["$post"]({ json });
            if (!response.ok) {
                const errorData = await response.json() as { error: string };
                throw new Error(errorData.error || "Failed to leave workspace");
            }
            return await response.json();
        },
        onSuccess: (data) => {
            toast.success(`Successfully left workspace. ${data.data.reassignedTasks} tasks reassigned to admin.`);
            queryClient.invalidateQueries({ queryKey: ["members"] });
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            // Redirect to workspace selection
            router.push("/");
        },
        onError: (error) => {
            toast.error(error.message || "Failed to leave workspace");
        }
    });

    return mutation;
};
